# AEMS v2 — AWS Deployment (EC2 + RDS MySQL + S3)

## 1. RDS MySQL
1. RDS → Create database → **MySQL 8.0 / 8.4**, same VPC as the EC2 instance, *Public access: No*.
2. Security group: allow inbound **3306** only from the EC2 instance's security group.
3. From the EC2 box, create the database and an app user:
   ```sql
   CREATE DATABASE aems CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
   CREATE USER 'aems_app'@'%' IDENTIFIED BY '<strong-password>';
   GRANT SELECT, INSERT, UPDATE, DELETE ON aems.* TO 'aems_app'@'%';
   ```
4. Load the schema + seed data (as the admin user):
   ```bash
   mysql -h <rds-endpoint> -u admin -p aems < aws/mysql_schema.sql
   ```
   Seeded login: `software.2040@pgel.in` (IT Admin). Change/add real users from **User Management** after first login.

## 2. S3 bucket (attachments)
1. Create a bucket (e.g. `aems-attachments`), region `ap-south-1`, **Block all public access: ON**.
2. IAM role for EC2 with this policy, then attach the role to the instance:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Effect": "Allow",
       "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
       "Resource": "arn:aws:s3:::aems-attachments/uploads/*"
     }]
   }
   ```
   Files are served through `/api/files/...` (login required) using short-lived presigned URLs.

## 3. EC2 (Ubuntu 22.04/24.04)
Security group: inbound 80/443 from anywhere, 22 from your IP only.
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs nginx mysql-client
sudo npm install -g pm2

# copy the project to /opt/aems (git clone or scp), then:
cd /opt/aems
cp aws/env.example .env.production.local   # fill in all values
npm ci
npm run build
pm2 start aws/ecosystem.config.cjs
pm2 save && pm2 startup                    # run the printed command to enable boot start
```

## 4. Nginx + HTTPS
```bash
sudo cp aws/nginx-aems.conf /etc/nginx/sites-available/aems   # edit server_name
sudo ln -s /etc/nginx/sites-available/aems /etc/nginx/sites-enabled/aems
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d aems.example.com
```
After HTTPS works set `SESSION_COOKIE_SECURE=true` in `.env.production.local`, then `pm2 restart aems`.

## 5. Updating
```bash
cd /opt/aems && git pull && npm ci && npm run build && pm2 restart aems
```

## Notes
- OTP emails use Office 365 SMTP. OTPs are never logged or returned by the API; if SMTP fails, login fails with an error. IT Admin can verify SMTP at `GET /api/auth/test-smtp`.
- The app refuses to start in production if `AEMS_MOCK_MODE=true` is set.
- Old base64 attachments keep working; new uploads go to S3.
