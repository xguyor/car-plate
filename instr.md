# CarBlock Alert - Setup Instructions

## Step 1: Copy Files (5 min)

Copy all provided code files into your project:

```bash
cd ~/projects/carblock-alert

# Create directories
mkdir -p app/auth/login app/auth/callback app/camera app/profile app/history
mkdir -p app/api/ocr app/api/alert
```

Then copy each file from the artifacts into the correct location.

## Step 2: Setup Supabase (10 min)

1. Go to https://supabase.com
2. Sign up (free) → Create New Project
3. Project Name: `carblock-alert`
4. Database Password: (save this)
5. Region: Choose closest to Israel
6. Wait 2 minutes for project to initialize

### Get API Keys
- Go to **Settings** → **API**
- Copy `Project URL` and `anon public` key
- Add to `.env.local`

### Run Database Schema
- Go to **SQL Editor** → **New Query**
- Paste the entire `supabase-schema.sql` content
- Click **Run**
- Should see "Success. No rows returned"

### Setup Google OAuth
1. In Supabase: **Authentication** → **Providers** → **Google**
2. Click **Enabled**
3. Keep this tab open (we'll add credentials from Google next)

## Step 3: Google OAuth Setup (10 min)

1. Go to https://console.cloud.google.com
2. Create project: "CarBlock Alert"
3. **APIs & Services** → **OAuth consent screen**
   - User Type: **Internal** (restricts to your domain)
   - App name: CarBlock Alert
   - User support email: your@forsightrobotics.com
   - Developer email: your@forsightrobotics.com
   - Click **Save and Continue**
4. **Scopes** → Skip (click **Save and Continue**)
5. **Test users** → Skip (click **Save and Continue**)

6. **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Name: CarBlock Alert Web
   - **Authorized redirect URIs** → Add:
     ```
     https://[YOUR-PROJECT-ID].supabase.co/auth/v1/callback
     ```
     (Replace [YOUR-PROJECT-ID] with your actual Supabase project ID from URL)
   - Click **Create**

7. **Copy Client ID and Client Secret**

8. Go back to Supabase → **Authentication** → **Providers** → **Google**
   - Paste **Client ID** and **Client Secret**
   - Click **Save**

## Step 4: Get API Keys (10 min)

### OCR.space (Free)
1. Go to https://ocr.space/ocrapi
2. Click **Register**
3. Email: your@forsightrobotics.com
4. Confirm email → Copy API key
5. Add to `.env.local`

### Resend (Free)
1. Go to https://resend.com
2. Sign up with Google
3. **API Keys** → **Create API Key**
4. Name: CarBlock Alert
5. Copy key → Add to `.env.local`

### Generate VAPID Keys
```bash
npx web-push generate-vapid-keys
```
Copy both keys to `.env.local`

## Step 5: Configure Environment Variables

Edit `.env.local`:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
OCR_SPACE_API_KEY=K12345678...
RESEND_API_KEY=re_12345...
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BHJd8f9...
VAPID_PRIVATE_KEY=wB8jkK...
```

## Step 6: Install Missing Dependencies

```bash
npm install @supabase/supabase-js @supabase/auth-helpers-nextjs
npm install resend web-push
npm install -D @types/web-push
```

## Step 7: Test Locally

```bash
npm run dev
```

Visit http://localhost:3000

### Test Flow:
1. Click "Sign in with Google"
2. Use your @forsightrobotics.com account
3. Should redirect to Camera page
4. Go to Profile → Enter car plate (e.g., 12-345-67)
5. Save profile
6. Go back to Camera → Test camera access
7. Take photo → Detect plate → Send alert (to yourself for testing)
8. Check email inbox

## Step 8: Create App Icons (5 min)

You need two icon files:
- `public/icon-192.png` (192x192 px)
- `public/icon-512.png` (512x512 px)

Quick way:
1. Use any car emoji or create simple icon at https://www.canva.com
2. Export as PNG in both sizes
3. Place in `public/` folder

Or use placeholder:
```bash
# Download free icon
curl -o public/icon-192.png https://via.placeholder.com/192/2563eb/ffffff?text=CB
curl -o public/icon-512.png https://via.placeholder.com/512/2563eb/ffffff?text=CB
```

## Step 9: Deploy to Vercel (5 min)

### Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
gh repo create carblock-alert --public --source=. --remote=origin --push
```

Or manually create repo on GitHub and push.

### Deploy on Vercel
1. Go to https://vercel.com
2. Sign up with GitHub
3. **Import Project** → Select `carblock-alert`
4. **Environment Variables** → Add all from `.env.local`
5. Click **Deploy**
6. Wait 2 minutes
7. Copy your deployment URL: `https://carblock-alert.vercel.app`

### Update Supabase URLs
1. Go to Supabase → **Authentication** → **URL Configuration**
2. **Site URL**: `https://carblock-alert.vercel.app`
3. **Redirect URLs** → Add:
   ```
   https://carblock-alert.vercel.app/**
   ```
4. Click **Save**

### Update Google OAuth
1. Go to Google Cloud Console → **Credentials**
2. Edit your OAuth 2.0 Client
3. **Authorized redirect URIs** → Keep Supabase one, no need to add Vercel

## Step 10: Test Production

1. Visit your Vercel URL
2. Test full flow with 2 different @forsightrobotics.com accounts
3. Test on mobile device (camera works best)
4. Test push notifications (requires HTTPS)

## Troubleshooting

### "Email not allowed"
- Check Google Cloud Console → OAuth consent screen → User Type must be **Internal**
- Check email ends with @forsightrobotics.com

### Camera not working
- Must use HTTPS (localhost or deployed site)
- Check browser permissions

### OCR not detecting plate
- Ensure good lighting
- Photo should be clear and focused
- License plate should be visible
- Try manual entry

### Push notifications not working on iOS
- User must **Add to Home Screen**
- Go to Share → Add to Home Screen
- Open from home screen
- Enable notifications

### Database errors
- Check Supabase SQL Editor for errors
- Ensure all tables created successfully
- Check RLS policies are enabled

## Next Steps

1. Invite all employees to sign up
2. Have everyone set their car plate in Profile
3. Enable push notifications
4. Test in real parking situation
5. Monitor Supabase logs for errors
6. Adjust rate limits if needed

## Production Checklist

- [ ] All employees signed up
- [ ] Car plates registered
- [ ] Email notifications working
- [ ] Push notifications enabled (iOS users add to home screen)
- [ ] Test with multiple users
- [ ] Monitor Supabase dashboard
- [ ] Check Vercel logs for errors
- [ ] Set up monitoring/alerts

## Costs

- Supabase: Free (up to 500MB DB)
- Vercel: Free (100GB bandwidth)
- OCR.space: Free (25K/month)
- Resend: Free (3K emails/month)
- Google OAuth: Free
- Web Push: Free

**Total: $0/month** for <100 employees