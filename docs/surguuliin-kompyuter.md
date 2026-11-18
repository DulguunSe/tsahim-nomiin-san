# Сургуулийн компьютерээс интернэтэд үнэгүй нээх

Энэ заавраар цахим номын санг **сургуулийн нэг компьютер** дээр ажиллуулж,
**Tailscale Funnel**-ээр интернэтэд гаргана. Ингэснээр:

- Сайт `https://nomiin-san.tailXXXX.ts.net` маягийн **тогтмол хаягтай** болно.
- Бүрэн **үнэгүй**: карт, домэйн хэрэггүй.
- Номын тоо хязгааргүй, зөвхөн компьютерийн дискний багтаамжаас хамаарна.

```
Сурагч (гэр, утас)  ──►  https://nomiin-san.….ts.net  ──►  Сургуулийн компьютер
                         (Tailscale, HTTPS)                 (номын сангийн сервер)
```

**Шаардлага:**
- Windows 10/11 компьютер. Өдөр шөнөгүй асаалттай, интернэтэд холбогдсон байна.
- Сурагчид PDF хэр хурдан татах нь сургуулийн интернэтийн **upload** хурдаас хамаарна.

---

## 1. Програмууд суулгах

1. **Node.js**: https://nodejs.org сайтаас **LTS** хувилбарыг татаж суулгана
   (бүх тохиргоог анхдагчаар нь үлдээнэ).
2. **Git**: https://git-scm.com/download/win сайтаас татаж суулгана.
   Git суулгахгүй бол GitHub дээрх **Code → Download ZIP**-ээр татаж, `C:\nomiin-san`
   хавтас руу задалж болно.

## 2. Төслийг татах

**Start** цэснээс **PowerShell**-ийг нээгээд дараах командуудыг ээлжлэн ажиллуулна:

```powershell
cd C:\
git clone https://github.com/DulguunSe/tsahim-nomiin-san.git nomiin-san
cd C:\nomiin-san
npm install
```

## 3. Тохиргоо хийх

```powershell
copy .env.example .env
notepad .env
```

Нээгдсэн файлд дараах мөрүүдийг өөрчлөөд хадгална:

```ini
SCHOOL_NAME=Манай сургууль
ADMIN_PASSWORD=энд_хүчтэй_нууц_үг
TRUST_PROXY=1
```

`COOKIE_SECURE` мөрийг **хоосон** үлдээнэ.

## 4. Туршиж асаах

```powershell
npm start
```

Хөтөч дээр http://localhost:3000 хаягийг нээж сайт ажиллаж байгааг шалгана.
Дараа нь PowerShell цонхонд **Ctrl + C** дарж зогсооно.

> 💡 Дараа нь гараар асаах бол `scripts\windows\start.bat` файлыг давхар дарахад хангалттай.

## 5. Компьютер асахад автоматаар асдаг болгох

**Start** цэснээс **PowerShell** дээр баруун товч дарж **Run as administrator**-ийг сонгоно:

```powershell
cd C:\nomiin-san
powershell -ExecutionPolicy Bypass -File scripts\windows\autostart.ps1
```

`Бэлэн!` гэсэн ногоон бичиг гарвал амжилттай. Энэ скрипт дараах зүйлсийг хийнэ:
- Windows асахад серверийг автоматаар асаана. Хэн ч нэвтрээгүй байсан ч ажиллана.
- Сервер унтарвал 1 минутын дараа дахин асаана.
- Серверийн мэдээллийг `data\server.log` файлд бичнэ.
- Сургуулийн дотоод сүлжээнээс хандах Firewall зөвшөөрөл нэмнэ.
- Цахилгаанд залгаатай үед компьютерийг унтдаггүй болгоно.

> ⚠️ Үүнээс хойш сервер дэвсгэрт өөрөө ажиллана. `npm start` эсвэл `start.bat`-ийг
> давхар ажиллуулбал "port already in use" алдаа гарна, тиймээс шаардлагагүй.

## 6. Tailscale-ээр интернэтэд нээх

1. https://tailscale.com/download сайтаас **Windows** хувилбарыг татаж суулгана.
2. Суулгасны дараа **Google, Microsoft эсвэл GitHub** бүртгэлээрээ нэвтэрнэ.
3. *(Заавал биш)* Хаягаа гоё болгох бол https://login.tailscale.com/admin/machines
   хуудаснаас энэ компьютерийн ард байгаа **⋯ → Edit machine name** дарж нэрийг нь
   `nomiin-san` болгоно.
4. **Run as administrator**-аар нээсэн PowerShell-д:

   ```powershell
   tailscale funnel --bg 3000
   ```

   Анх удаа ажиллуулахад Funnel-ийг идэвхжүүлэх **холбоос** гарна. Тэр холбоосыг
   нээж **Enable** дараад, дээрх командыг дахин ажиллуулна.

5. Дараах маягийн хаяг гарна:

   ```
   https://nomiin-san.tail1234.ts.net/
   ```

   Энэ бол таны сайтын **байнгын интернэт хаяг**. Сурагч, багш нартаа хуваалцаарай.
   Компьютер дахин асахад ч энэ хаяг өөрчлөгдөхгүй.

Хэрэгтэй командууд:

```powershell
tailscale funnel status
```

```powershell
tailscale funnel reset
```

`status` нь одоо юу нээлттэй байгааг харуулна, `reset` нь интернэтэд нээхээ зогсооно.

> Tailscale-ийн үнэгүй (Personal) багц нь арилжааны бус хэрэглээнд зориулагдсан.
> Funnel-ээр дамжих урсгалд Tailscale хурдны хязгаар тавьдаг ч тодорхой тоог
> нийтэлдэггүй. Олон хүн зэрэг их хэмжээний файл татвал удааширч болзошгүй.

---

## Өдөр тутмын арчилгаа

| Юу хийх                          | Хэрхэн                                                                 |
|----------------------------------|------------------------------------------------------------------------|
| Серверийн алдаа харах            | `notepad C:\nomiin-san\data\server.log`                                |
| Серверийг дахин асаах            | Admin PowerShell-д доорх 2 командыг ажиллуулна                         |
| Нөөц хуулбар (backup)            | `C:\nomiin-san\data` хавтсыг флаш/Google Drive руу тогтмол хуулах       |
| Автоматаар асахыг болиулах       | `powershell -ExecutionPolicy Bypass -File scripts\windows\autostart.ps1 -Remove` |

Серверийг дахин асаах (Admin PowerShell):

```powershell
Stop-ScheduledTask -TaskName TsahimNomiinSan
```

```powershell
Start-ScheduledTask -TaskName TsahimNomiinSan
```

**Шинэ хувилбар суулгах:** `C:\nomiin-san` хавтсанд `git pull`, дараа нь
`npm install` ажиллуулаад серверийг дахин асаана.

**Цахилгаан тасрах үед:** компьютерийн BIOS тохиргоонд **Restore on AC Power Loss →
Power On** гэсэн сонголт байдаг. Үүнийг асаавал цахилгаан ирэхэд компьютер өөрөө
асна. Компьютер асмагц сервер болон Tailscale автоматаар ажиллана.

---

## Өөр арга: Cloudflare Quick Tunnel (хаяг нь солигддог)

Tailscale ашиглах боломжгүй бол түр туршихад тохиромжтой:

```powershell
winget install --id Cloudflare.cloudflared
```

```powershell
cloudflared tunnel --url http://localhost:3000
```

`https://санамсаргүй-үгс.trycloudflare.com` хаяг гарна. Гэхдээ **команд дахин
ажиллах бүрт хаяг өөрчлөгдөнө** бөгөөд Cloudflare үүнийг зөвхөн туршилтад
зориулсан гэж заадаг. Тогтмол хаяг авахын тулд өөрийн домэйн хэрэгтэй (Cloudflare
named tunnel).

---

## Linux компьютер дээр

Ubuntu/Debian серверт systemd ашиглана. `/etc/systemd/system/nomiin-san.service` файл үүсгэнэ:

```ini
[Unit]
Description=Tsahim nomiin san
After=network-online.target

[Service]
WorkingDirectory=/opt/nomiin-san
ExecStart=/usr/bin/node server.js
Restart=always
User=www-data

[Install]
WantedBy=multi-user.target
```

```bash
sudo mkdir -p /opt/nomiin-san/data && sudo chown -R www-data /opt/nomiin-san/data
```

```bash
sudo systemctl enable --now nomiin-san
```

```bash
sudo tailscale funnel --bg 3000
```
