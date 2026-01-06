# OAuth Setup Guide - Google & GitHub Authentication

This guide explains how to set up OAuth authentication with Google and GitHub in your Supabase project.

## 🎯 Overview

OAuth allows users to sign in using their existing Google or GitHub accounts, providing a seamless authentication experience without creating new passwords.

**Benefits:**
- ✅ No password management for users
- ✅ Faster sign-up/sign-in process
- ✅ Automatic email verification
- ✅ Trusted third-party authentication
- ✅ Better user experience

---

## 📋 Prerequisites

Before you begin, make sure you have:
- A Supabase project (create one at [supabase.com](https://supabase.com))
- Your Supabase project URL and anon key configured in `.env`
- Access to [Google Cloud Console](https://console.cloud.google.com) (for Google OAuth)
- Access to [GitHub Developer Settings](https://github.com/settings/developers) (for GitHub OAuth)

---

## 🔵 Google OAuth Setup

### Step 1: Create Google OAuth Client

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth Client ID**
5. Configure the consent screen if prompted:
   - **User Type**: External
   - **App Name**: Your app name (e.g., "Deepfake Detection System")
   - **User Support Email**: Your email
   - **Developer Contact**: Your email
   - Add scopes: `email`, `profile`, `openid`
   - Click **Save and Continue**

### Step 2: Configure OAuth Client

1. **Application Type**: Web application
2. **Name**: Your app name (e.g., "Deepfake Detector Web")
3. **Authorized JavaScript Origins**:
   ```
   http://localhost:5173
   https://your-production-domain.com
   ```
4. **Authorized Redirect URIs**:
   ```
   https://YOUR_SUPABASE_PROJECT_REF.supabase.co/auth/v1/callback
   ```
   Replace `YOUR_SUPABASE_PROJECT_REF` with your actual Supabase project reference (found in your Supabase project URL)

5. Click **Create**
6. **Save your credentials**:
   - Client ID: `xxxxx.apps.googleusercontent.com`
   - Client Secret: `GOCSPX-xxxxx`

### Step 3: Add to Supabase

1. Go to your Supabase dashboard
2. Navigate to **Authentication** → **Providers**
3. Find **Google** and click to expand
4. Toggle **Enable Sign in with Google**
5. Enter your **Client ID** and **Client Secret**
6. Click **Save**

---

## ⚫ GitHub OAuth Setup

### Step 1: Create GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **OAuth Apps** → **New OAuth App**
3. Fill in the application details:
   - **Application Name**: Your app name (e.g., "Deepfake Detection System")
   - **Homepage URL**: 
     ```
     http://localhost:5173
     ```
     (Or your production URL)
   - **Application Description**: Brief description of your app (optional)
   - **Authorization Callback URL**:
     ```
     https://YOUR_SUPABASE_PROJECT_REF.supabase.co/auth/v1/callback
     ```
     Replace `YOUR_SUPABASE_PROJECT_REF` with your actual Supabase project reference

4. Click **Register Application**

### Step 2: Generate Client Secret

1. After creating the app, you'll see your **Client ID**
2. Click **Generate a new client secret**
3. **Save your credentials**:
   - Client ID: `Iv1.xxxxx`
   - Client Secret: `xxxxx` (shown only once!)

### Step 3: Add to Supabase

1. Go to your Supabase dashboard
2. Navigate to **Authentication** → **Providers**
3. Find **GitHub** and click to expand
4. Toggle **Enable Sign in with GitHub**
5. Enter your **Client ID** and **Client Secret**
6. Click **Save**

---

## 🔗 Finding Your Supabase Callback URL

Your Supabase callback URL follows this format:
```
https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
```

**How to find YOUR_PROJECT_REF:**

1. Go to your Supabase project dashboard
2. Look at the URL bar - it should be:
   ```
   https://supabase.com/dashboard/project/YOUR_PROJECT_REF
   ```
3. Or go to **Settings** → **API** and look at your **Project URL**:
   ```
   https://YOUR_PROJECT_REF.supabase.co
   ```

---

## 🧪 Testing OAuth Integration

### Local Development Testing

1. **Start your dev server**:
   ```bash
   npm run dev
   ```

2. **Navigate to Login or Signup page**
3. **Click on "Continue with Google" or "Continue with GitHub"**
4. **You should be redirected to the OAuth provider**
5. **After authorization, you'll be redirected back to your app**
6. **Check that you're logged in**

### Common Issues

**Issue**: Redirect URI mismatch
- **Solution**: Make sure the callback URL in Google/GitHub matches exactly with your Supabase project URL

**Issue**: OAuth flow starts but doesn't complete
- **Solution**: Check your browser console for errors and ensure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set correctly

**Issue**: "Configuration not found" error
- **Solution**: Ensure OAuth providers are enabled in Supabase dashboard

---

## 🚀 Production Deployment

### Before Deploying:

1. **Update authorized domains** in Google Cloud Console:
   - Add your production domain to **Authorized JavaScript Origins**
   - Add your production domain to **Authorized Redirect URIs** (if different from Supabase)

2. **Update homepage URL** in GitHub OAuth App:
   - Change from `http://localhost:5173` to your production URL

3. **Set environment variable**:
   ```bash
   VITE_SITE_URL=https://your-production-domain.com
   ```

### Additional Security (Optional)

1. **Restrict OAuth to specific email domains** (Supabase):
   - Go to **Authentication** → **Providers**
   - Under each provider, you can add email domain restrictions

2. **Enable MFA** for added security:
   - Go to **Authentication** → **Settings**
   - Enable **Multi-Factor Authentication**

---

## 📊 User Data Handling

When a user signs in with OAuth, Supabase automatically creates a user account with:

- `email` - User's email from OAuth provider
- `user_metadata.full_name` - User's full name (if available)
- `user_metadata.avatar_url` - User's profile picture URL
- `app_metadata.provider` - OAuth provider used ('google' or 'github')

You can access this data in your app:
```typescript
const { user } = useAuth()

console.log(user?.email)
console.log(user?.user_metadata?.full_name)
console.log(user?.user_metadata?.avatar_url)
console.log(user?.app_metadata?.provider)
```

---

## 🔐 Security Best Practices

1. **Never commit OAuth secrets** to version control
   - Keep credentials in `.env` (already in `.gitignore`)

2. **Use different OAuth apps** for development and production
   - Prevents accidental data mixing

3. **Regularly rotate secrets** 
   - Update Client Secrets periodically

4. **Monitor authentication logs**
   - Check Supabase **Authentication** → **Logs** for suspicious activity

5. **Enable email verification**
   - Supabase handles this automatically for OAuth users

---

## 📚 Additional Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Google OAuth 2.0 Guide](https://developers.google.com/identity/protocols/oauth2)
- [GitHub OAuth Apps Guide](https://docs.github.com/en/developers/apps/building-oauth-apps)

---

## 🆘 Troubleshooting

### Google OAuth Issues

**Error: "redirect_uri_mismatch"**
```
Solution: Ensure the callback URL in Google Console exactly matches:
https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
```

**Error: "access_denied"**
```
Solution: User cancelled the OAuth flow or hasn't given consent
```

### GitHub OAuth Issues

**Error: "Application suspended"**
```
Solution: Check your GitHub app settings and ensure it's active
```

**Error: "Bad verification code"**
```
Solution: This is usually a temporary issue. Try again or regenerate client secret
```

### Supabase Issues

**Error: "Provider not enabled"**
```
Solution: Enable the OAuth provider in Supabase dashboard:
Authentication → Providers → Toggle on Google/GitHub
```

**Error: "Invalid provider"**
```
Solution: Ensure you're passing 'google' or 'github' as the provider string
```

---

## ✅ Setup Checklist

Use this checklist to ensure everything is configured correctly:

### Google OAuth
- [ ] Created Google Cloud project
- [ ] Configured OAuth consent screen
- [ ] Created OAuth Client ID
- [ ] Added authorized JavaScript origins
- [ ] Added authorized redirect URIs with Supabase callback URL
- [ ] Saved Client ID and Client Secret
- [ ] Added credentials to Supabase dashboard
- [ ] Enabled Google provider in Supabase
- [ ] Tested login flow

### GitHub OAuth
- [ ] Created GitHub OAuth App
- [ ] Set homepage URL
- [ ] Set authorization callback URL with Supabase callback
- [ ] Generated and saved Client Secret
- [ ] Added credentials to Supabase dashboard
- [ ] Enabled GitHub provider in Supabase
- [ ] Tested login flow

### General
- [ ] Environment variables set correctly
- [ ] Tested on local development
- [ ] Prepared production URLs
- [ ] Reviewed security best practices

---

**Need help?** Check the [Supabase Discord](https://discord.supabase.com) or [GitHub Discussions](https://github.com/supabase/supabase/discussions)
