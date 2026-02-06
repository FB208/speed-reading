<# 
================================================================================
                    PowerShell 脚本学习指南
================================================================================

首先，让我解释这个脚本的关键语法：

1. 变量: 以$开头，例如 $name = "value"
2. 注释: # 单行注释，<井号 井号> 多行注释
3. 比较: -eq (等于), -ne (不等于), -gt (大于), -lt (小于)
4. 逻辑: -and (与), -or (或), -not (非)
5. 输出: Write-Host "文本" -ForegroundColor Green
6. 命令执行: 直接使用命令，或用 $() 包裹表达式
7. 错误处理: try { } catch { }
8. 条件判断: if (条件) { } elseif (条件) { } else { }
9. 循环: foreach ($item in $collection) { }
10. 函数: function 函数名 { param($参数1, $参数2) ... }

================================================================================
                         脚本说明文档
================================================================================

.SYNOPSIS
    将 .env.secrets 文件同步到 GitHub Secrets

.DESCRIPTION
    此脚本从项目根目录读取 .env.secrets 文件，
    解析每一行的 KEY=VALUE 格式，
    并使用 GitHub CLI (gh) 将它们同步为仓库的 Secrets。

.EXAMPLE
    .\.github\scripts\sync-secrets.ps1

.NOTES
    前置条件:
    - 安装 GitHub CLI: winget install GitHub.cli
    - 登录 GitHub: gh auth login
    - 存在 .env.secrets 文件，格式为 KEY=VALUE

================================================================================
#>

# ============================================================================
# 配置部分
# ============================================================================

# 设置错误处理策略：遇到错误时立即停止脚本
# 可选值: Stop(停止), Continue(继续), SilentlyContinue(静默继续), Inquire(询问)
$ErrorActionPreference = "Stop"

# ============================================================================
# 路径解析
# ============================================================================

# $MyInvocation 是一个自动变量，包含当前脚本的信息
# $MyInvocation.MyCommand.Path = 当前脚本的完整路径
# Split-Path -Parent = 获取路径的父目录

# 获取当前脚本所在的目录
# 例如: D:\project\.github\scripts
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# 向上两级获取项目根目录
# .github\scripts -> .github -> 项目根目录
# 例如: D:\project
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $ScriptDir)

# 构建 .env.secrets 文件的完整路径
# Join-Path 会使用正确的路径分隔符安全地拼接路径
$EnvFile = Join-Path $ProjectRoot ".env.secrets"

# ============================================================================
# 前置条件检查
# ============================================================================

# --- 检查 1: 验证 .env.secrets 文件是否存在 ---
# Test-Path 检查路径是否存在，存在返回 $true，否则返回 $false
if (-not (Test-Path $EnvFile)) {
    # Write-Host 将文本输出到控制台
    # -ForegroundColor 设置文本颜色 (Red红, Green绿, Yellow黄, Cyan青, White白 等)
    Write-Host "[ERROR] .env.secrets not found" -ForegroundColor Red
    Write-Host "        Please copy .env.secrets.example to .env.secrets" -ForegroundColor Yellow
    # exit 1 = 以错误码 1 退出脚本 (非零 = 错误)
    exit 1
}

# --- 检查 2: 验证 GitHub CLI 是否已安装 ---
# try-catch 用于错误处理
try {
    # Get-Command 检查命令/程序是否存在
    # -ErrorAction Stop 如果未找到则抛出错误
    # $null = ... 丢弃输出（我们只关心是否出错）
    $null = Get-Command gh -ErrorAction Stop
} catch {
    Write-Host "[ERROR] GitHub CLI (gh) not installed" -ForegroundColor Red
    Write-Host "        Run: winget install GitHub.cli" -ForegroundColor Yellow
    exit 1
}

# --- 检查 3: 验证 GitHub CLI 是否已登录 ---
# 2>&1 将错误输出重定向到标准输出，这样我们可以捕获错误信息
$authStatus = gh auth status 2>&1
# $LASTEXITCODE 包含上一个外部命令的退出码
# 0 = 成功, 非零 = 错误
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] GitHub CLI not logged in" -ForegroundColor Red
    Write-Host "        Run: gh auth login" -ForegroundColor Yellow
    exit 1
}

# ============================================================================
# 解析配置文件
# ============================================================================

Write-Host "[INFO] Reading config: $EnvFile" -ForegroundColor Cyan
Write-Host ""

# 创建一个空的哈希表（字典/映射）来存储键值对
# @{} = 空哈希表, @{key1="value1"; key2="value2"} = 带值的哈希表
$secrets = @{}

# Get-Content 读取文件内容，返回行数组
# | (管道) 将输出传递给下一个命令
# ForEach-Object 处理管道中的每一项
# $_ 是管道中的当前项
Get-Content $EnvFile | ForEach-Object {
    # .Trim() 移除首尾空白字符
    $line = $_.Trim()
    
    # 跳过空行和注释（以 # 开头的行）
    # -and 是逻辑与
    # -not 是逻辑非
    # .StartsWith() 检查字符串是否以指定前缀开头
    if ($line -and -not $line.StartsWith("#")) {
        
        # 查找第一个 "=" 字符的位置
        # .IndexOf() 未找到时返回 -1
        $eqIndex = $line.IndexOf("=")
        
        # 如果找到 "=" 且不在开头
        # -gt 意思是 "大于"
        if ($eqIndex -gt 0) {
            # .Substring(起始位置, 长度) 提取字符串的一部分
            # .Substring(起始位置) 从起始位置提取到末尾
            $key = $line.Substring(0, $eqIndex).Trim()
            $value = $line.Substring($eqIndex + 1).Trim()
            
            # 添加到哈希表: $哈希表[$键] = $值
            $secrets[$key] = $value
        }
    }
}

# .Count 返回集合中的元素数量
if ($secrets.Count -eq 0) {
    Write-Host "[WARN] No valid config found in file" -ForegroundColor Yellow
    exit 0
}

# ============================================================================
# 同步到 GitHub Secrets
# ============================================================================

# $() 是子表达式运算符，计算表达式并插入结果
Write-Host "[INFO] Syncing $($secrets.Count) secrets to GitHub..." -ForegroundColor Cyan
Write-Host ""

# 初始化计数器
$successCount = 0
$failCount = 0

# .Keys 返回哈希表中的所有键
# foreach 遍历每一项
foreach ($key in $secrets.Keys) {
    # 获取当前键对应的值
    $value = $secrets[$key]
    
    # -NoNewline 阻止输出后换行
    # 这样下一个 Write-Host 可以在同一行继续输出
    Write-Host "   Setting $key ... " -NoNewline
    
    try {
        # 通过管道将值传递给 gh 命令，避免在命令行中暴露敏感信息
        # gh secret set <名称> 从标准输入读取 secret 值
        # | Out-Null 丢弃命令的任何输出
        $value | gh secret set $key 2>&1 | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK]" -ForegroundColor Green
            # ++ 将变量值增加 1
            $successCount++
        } else {
            Write-Host "[FAIL]" -ForegroundColor Red
            $failCount++
        }
    } catch {
        # 在 catch 块中 $_ 包含错误对象
        Write-Host "[FAIL] $_" -ForegroundColor Red
        $failCount++
    }
}

# ============================================================================
# 输出摘要
# ============================================================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Gray

# -eq 意思是 "等于"
if ($failCount -eq 0) {
    Write-Host "[DONE] Successfully synced $successCount secrets" -ForegroundColor Green
} else {
    Write-Host "[DONE] Success: $successCount, Failed: $failCount" -ForegroundColor Yellow
}

# 显示仓库中当前的 secrets 列表
Write-Host ""
Write-Host "[INFO] Current repository secrets:" -ForegroundColor Cyan
# 直接调用 gh 命令列出 secrets
gh secret list

# ============================================================================
# 脚本结束
# ============================================================================
