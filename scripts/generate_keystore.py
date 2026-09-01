#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Android Release Keystore 生成脚本
用于生成 MoYu 正式发布所需的 Android 数字签名证书，并输出配置 GitHub Secrets 所需的 Base64 编码。
"""

import subprocess
import base64
import os
import sys
import secrets
import string

# 兼容 Windows 控制台输出
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def generate_secure_password(length=16):
    """生成包含字母和数字的安全随机密码（避免特殊字符在 shell 环境变量中引起转义问题）"""
    chars = string.ascii_letters + string.digits
    return ''.join(secrets.choice(chars) for _ in range(length))

def main():
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    keystore_filename = "moyu-release.jks"
    keystore_path = os.path.join(repo_root, keystore_filename)
    credentials_path = os.path.join(repo_root, "keystore-credentials.txt")
    
    alias = "moyu"
    
    if os.path.exists(keystore_path):
        print(f"[!] 检测到已存在证书文件: {keystore_path}")
        print("为防止覆盖已有发布证书导致老用户无法更新，将直接读取现有证书进行 Base64 转换。")
        password = None
    else:
        password = generate_secure_password(16)
        print(f"[*] 正在生成全新的 Android 数字证书: {keystore_filename} ...")
        cmd = [
            "keytool",
            "-genkeypair",
            "-v",
            "-keystore", keystore_path,
            "-alias", alias,
            "-keyalg", "RSA",
            "-keysize", "2048",
            "-validity", "10000",
            "-storepass", password,
            "-keypass", password,
            "-dname", "CN=MoYu, OU=Release, O=BA8BAK, L=Beijing, ST=Beijing, C=CN"
        ]
        
        try:
            res = subprocess.run(cmd, capture_output=True, text=True, check=True)
            print("[OK] 证书文件生成成功！")
        except subprocess.CalledProcessError as e:
            print(f"[X] keytool 生成证书失败: {e.stderr}")
            return

    # 读取证书并转为 Base64 字符串
    with open(keystore_path, "rb") as f:
        keystore_bytes = f.read()
        keystore_base64 = base64.b64encode(keystore_bytes).decode("utf-8")

    # 如果是新建证书，保存密码凭据到本地文件 keystore-credentials.txt
    if password:
        credentials_content = f"""# MoYu Android 签名证书凭证 (请妥善保存此文件，切勿提交至公开 Git 仓库)
证书文件: {keystore_filename}
密钥别名 (ALIAS): {alias}
证书密码 (STORE_PASSWORD): {password}
密钥密码 (KEY_PASSWORD): {password}

# 以下内容需要配置到 GitHub Repository Secrets:
ANDROID_KEY_ALIAS: {alias}
ANDROID_KEYSTORE_PASSWORD: {password}
ANDROID_KEY_PASSWORD: {password}
ANDROID_KEYSTORE_BASE64: (见终端输出或下文)
{keystore_base64}
"""
        with open(credentials_path, "w", encoding="utf-8") as f:
            f.write(credentials_content)
        print(f"[OK] 凭证备份已写入本地文件: {credentials_path}（已被 .gitignore 保护）")

    print("\n" + "=" * 65)
    print("🚀 请将以下 4 项添加到 GitHub 仓库的 Actions Secrets 中：")
    print("网页入口：GitHub 仓库 -> Settings -> Secrets and variables -> Actions -> New repository secret")
    print("=" * 65)
    print(f"\n1. Secret Name:  ANDROID_KEY_ALIAS")
    print(f"   Secret Value: {alias}")
    
    if password:
        print(f"\n2. Secret Name:  ANDROID_KEYSTORE_PASSWORD")
        print(f"   Secret Value: {password}")
        print(f"\n3. Secret Name:  ANDROID_KEY_PASSWORD")
        print(f"   Secret Value: {password}")
    else:
        print("\n2. Secret Name:  ANDROID_KEYSTORE_PASSWORD\n   Secret Value: [请使用原有证书密码]")
        print("\n3. Secret Name:  ANDROID_KEY_PASSWORD\n   Secret Value: [请使用原有私钥密码]")

    print(f"\n4. Secret Name:  ANDROID_KEYSTORE_BASE64")
    print(f"   Secret Value:\n{keystore_base64}")
    print("=" * 65 + "\n")

if __name__ == "__main__":
    main()
