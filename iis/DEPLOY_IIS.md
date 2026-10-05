# AEMS — Windows Server (IIS + MySQL) Deployment Guide

This guide explains how to deploy the AEMS Next.js application on **Windows Server** using **IIS (as Reverse Proxy)** and **MySQL**.

---

## 1. Prerequisites on Windows Server

1. **Node.js (LTS v20 or v22)**:
   - Download & run Windows Installer (`.msi`) from https://nodejs.org
2. **Git for Windows**:
   - Download from https://git-scm.com/download/win
3. **IIS (Internet Information Services)**:
   - Enable via *Server Manager* -> *Add Roles and Features* -> *Web Server (IIS)*.
4. **IIS Extensions Required (Microsoft Official)**:
   - **URL Rewrite Module 2.1**: https://www.iis.net/downloads/microsoft/url-rewrite
   - **Application Request Routing (ARR) 3.0**: https://www.iis.net/downloads/microsoft/application-request-routing
   > *Note: In IIS Manager, click on the Server Name -> Open **Application Request Routing Cache** -> Click **Server Proxy Settings...** on the right panel -> Check **Enable proxy** -> Click Apply.*

---

## 2. MySQL Database Setup

1. Open **MySQL Command Line Client** or **MySQL Workbench**.
2. Create the `aems` database:
   ```sql
   CREATE DATABASE IF NOT EXISTS aems CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
   ```
3. Import the schema and seed tables:
   ```cmd
   mysql -u root -p aems < aws\mysql_schema.sql
   ```
   *(Default admin user created: `software.2040@pgel.in`).*

---

## 3. Clone Repository & Setup App

1. Open **PowerShell** or **Command Prompt (Run as Administrator)**.
2. Clone the repository into a directory (e.g. `C:\aems`):
   ```cmd
   git clone https://github.com/Kushagrash14/aems-noida.git C:\aems
   cd C:\aems
   ```
3. Create `.env.production.local` inside `C:\aems`:
   ```env
   NODE_ENV=production
   NEXT_PUBLIC_APP_URL=http://localhost
   SESSION_SECRET=kushagra-aems-production-secret-key-32-chars-long
   SESSION_COOKIE_SECURE=false

   # MySQL Connection
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=YOUR_MYSQL_PASSWORD_HERE
   DB_NAME=aems
   DB_SSL=false
   DB_POOL_SIZE=10

   # Office 365 SMTP (OTP Emails)
   SMTP_HOST=smtp.office365.com
   SMTP_PORT=587
   SMTP_EMAIL=verify.software2040@pgel.in
   SMTP_PASSWORD=fmdrdczrxkpjrbsv
   OTP_FROM_EMAIL=verify.software2040@pgel.in
   ```
4. Install dependencies and build:
   ```cmd
   npm ci
   npm run build
   ```

---

## 4. Run App as a Windows Service (via PM2)

To keep Next.js running 24/7 in background even after logging out of Windows:

1. Install PM2:
   ```cmd
   npm install -g pm2
   npm install -g pm2-windows-service
   ```
2. Start the Next.js app:
   ```cmd
   cd C:\aems
   pm2 start "npm" --name "aems" -- start -- -p 3000
   pm2 save
   ```
3. Test locally in browser: Visit `http://localhost:3000` to verify it loads.

---

## 5. Configure IIS Site & Reverse Proxy

1. Open **IIS Manager** (`inetmgr`).
2. Verify **ARR Proxy** is enabled:
   - Click top Server node -> Open **Application Request Routing Cache** -> **Server Proxy Settings** -> Check **Enable proxy** -> Click **Apply**.
3. Create or Use Website:
   - Under *Sites*, right click -> *Add Website* (or use *Default Web Site*).
   - Site name: `AEMS`
   - Physical path: `C:\aems\iis` (which contains the `web.config` file)
   - Binding: Port `80` (or `443` if using SSL certificate) and your server IP / domain.
4. Now open `http://<SERVER_IP>` in any browser on your network. IIS will proxy incoming requests to `http://127.0.0.1:3000` seamlessly!
