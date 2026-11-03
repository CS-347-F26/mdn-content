---
title: "Django Tutorial Part 12: Sending email"
short-title: "12: Sending email"
slug: Learn_web_development/Extensions/Server-side/Django/Email
page-type: learn-module-chapter
sidebar: learnsidebar
---

{{PreviousMenuNext("Learn_web_development/Extensions/Server-side/Django/Deployment", "Learn_web_development/Extensions/Server-side/Django/web_application_security", "Learn_web_development/Extensions/Server-side/Django")}}

Your _LocalLibrary_ site is now on the public internet, but nobody can sign up for it: the email verification and password reset links that django-allauth sends are still only printed to the console.
This page shows you how to make your deployed site send real email from your Google Cloud VM, using [Mailgun](https://www.mailgun.com/), an email-sending service.

> [!NOTE]
> This page was written for our course, and is not part of the original MDN tutorial.

<table>
  <tbody>
    <tr>
      <th scope="row">Prerequisites:</th>
      <td>
        Complete all previous tutorial topics, including <a href="/en-US/docs/Learn_web_development/Extensions/Server-side/Django/Deployment">Django Tutorial Part 11: Deploying Django to production</a>.
      </td>
    </tr>
    <tr>
      <th scope="row">Objective:</th>
      <td>To learn how Django sends email, and how to configure a deployed site to send real email reliably and securely.</td>
    </tr>
  </tbody>
</table>

## Overview

In [Django Tutorial Part 8: User authentication and permissions](/en-US/docs/Learn_web_development/Extensions/Server-side/Django/Authentication) we set `ACCOUNT_EMAIL_VERIFICATION = 'mandatory'`, so a new account can't log in until its owner clicks a link that allauth emails to them.
On your laptop, the `MAILERS` setting that `startproject` created uses the _console backend_, which prints each email in the terminal instead of sending it.
That's exactly what you want while developing, but on the server the "terminal" is `docker compose logs`, which your users can't read.

Django sends email through _mailers_, which are configured in the `MAILERS` setting.
Every part of Django that sends email (allauth, password resets, `send_mail()`, error reports to site admins) uses the `default` mailer, so changing that one setting is enough to make all of them send real email.
To send real email, the default mailer uses the _SMTP backend_, which hands each message to an SMTP server (a mail server that accepts mail and delivers it to the recipient's mail server).

### Why use an email-sending service?

Google Cloud doesn't have an email-sending service of its own, and Compute Engine [blocks outgoing connections on port 25](https://cloud.google.com/compute/docs/tutorials/sending-mail), the port that mail servers use to deliver mail to each other, so you can't run your own mail server on your VM.
Even if you could, mail from an unknown server on a cloud IP address mostly ends up in spam folders, or is rejected outright.

Instead, Google recommends handing your mail to an email-sending service such as Mailgun, over port 587, which isn't blocked.
Mailgun delivers the mail from its own servers, which other mail providers trust, and it _signs_ each message for your domain (using SPF and DKIM, which we'll set up below), so that recipients can check that the message really came from your site.
Mailgun's free plan lets you send up to 100 emails a day, which is plenty for a course project.

Other services, such as [SendGrid](https://sendgrid.com/), [Postmark](https://postmarkapp.com/) and [Amazon SES](https://aws.amazon.com/ses/), work the same way: each gives you an SMTP host, username and password, so the Django settings below work with any of them.

## Set up Mailgun

### Create an account

Sign up for a free account at [mailgun.com](https://signup.mailgun.com/new/signup), and choose the **Free** plan.

Mailgun asks for a credit card before it lets you send email from your own domain.
The free plan doesn't charge it; Mailgun uses it to discourage spammers.
Without a card, you can only use the _sandbox domain_ that Mailgun creates for you: see [Using the sandbox domain](#using_the_sandbox_domain) below.

When you sign up, Mailgun asks whether your account should be in the **US** or **EU** region.
Either works, but remember which one you chose: the SMTP server's hostname is different for each.

### Add your sending domain

You'll send email from a subdomain of the domain that you already use for your apps, such as `mg.yourdomain.dev`.
Using a subdomain keeps your site's email separate from anything else that might ever send mail as `yourdomain.dev`, and it doesn't interfere with the DNS records you created for your apps.

1. In the Mailgun dashboard, open **Send › Sending › Domains**, and select **Add new domain**.
2. Enter `mg.yourdomain.dev` as the domain name.
   (You can't rename a Mailgun domain later, so check the spelling.)
3. Mailgun then shows a list of DNS records to add. Leave this page open.

### Add the DNS records

At your domain registrar, where you created the wildcard `A` record for your apps in the previous article, add each record that Mailgun lists.
Copy the type, name and value of each one exactly from the Mailgun page, rather than from this page: they're different for every domain.
They will look something like this:

| Type    | Name                      | Value                                  | What it's for                                                                                       |
| ------- | ------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `TXT`   | `mg`                      | `v=spf1 include:mailgun.org ~all`      | **SPF**: says that Mailgun's servers are allowed to send mail for `mg.yourdomain.dev`.              |
| `TXT`   | `something._domainkey.mg` | `k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4…` | **DKIM**: the public key that recipients use to check Mailgun's signature on your messages.         |
| `MX`    | `mg`                      | `mxa.mailgun.org` (priority 10)        | Where replies and bounces for `mg.yourdomain.dev` go. Mailgun uses them to track failed deliveries. |
| `MX`    | `mg`                      | `mxb.mailgun.org` (priority 10)        | (A second mail server, in case the first is down.)                                                  |
| `CNAME` | `email.mg`                | `mailgun.org`                          | Optional: lets Mailgun track opens and clicks. You don't need it.                                   |

> [!NOTE]
> Most registrars want only the part of the name **before** your domain (for example, `mg`, not `mg.yourdomain.dev.`), and add the rest themselves.
> If yours shows the full name, check that you didn't end up with `mg.yourdomain.dev.yourdomain.dev`.

Back in Mailgun, select **Verify DNS settings**.
DNS changes usually take a few minutes, but can take a few hours; if verification fails, wait a while and try again.
You can check what the rest of the internet sees with [MxToolbox](https://mxtoolbox.com/SuperTool.aspx), using a **TXT Lookup** for `mg.yourdomain.dev`.

Once the domain shows as **Verified**, Mailgun will deliver mail from it to anyone.

### Create SMTP credentials

Mailgun's SMTP passwords are separate from the password you log in to Mailgun with, and each one only works for one domain.

1. Open **Send › Sending › Domain settings**, choose `mg.yourdomain.dev` from the domain list at the top, and open the **SMTP credentials** tab.
2. Select **Add new SMTP user**, and enter a login such as `locallibrary` (so the username is `locallibrary@mg.yourdomain.dev`).
3. Mailgun shows the password **once**.
   Copy it into your password manager now.

If you ever think the password has leaked, delete the SMTP user on the same page and create a new one.
Using a different SMTP user for each of your apps means that you can do that for one app without breaking the others.

## Configure Django to send email

Do this on your laptop, in your _LocalLibrary_ repository.

### The mailer settings

Open **locallibrary_config/settings.py**, find the `MAILERS` setting that `startproject` created, and replace it with the following:

```python
# Email
# https://docs.djangoproject.com/en/6.1/topics/email/#topic-email-configuration

if env('EMAIL_HOST_USER', default=''):
    # Send real email through Mailgun (or another SMTP service).
    MAILERS = {
        'default': {
            'BACKEND': 'django.core.mail.backends.smtp.EmailBackend',
            'OPTIONS': {
                'host': env('EMAIL_HOST', default='smtp.mailgun.org'),
                'port': 587,
                'use_tls': True,
                'username': env('EMAIL_HOST_USER'),
                'password': env('EMAIL_HOST_PASSWORD'),
                'timeout': 10,
            },
        },
    }
else:
    # No email account configured: print emails to the console instead.
    MAILERS = {
        'default': {
            'BACKEND': 'django.core.mail.backends.console.EmailBackend',
        },
    }

# The "From" address of the emails that the site sends.
DEFAULT_FROM_EMAIL = env('DEFAULT_FROM_EMAIL', default='webmaster@localhost')
# The "From" address of error emails sent to ADMINS.
SERVER_EMAIL = DEFAULT_FROM_EMAIL
```

This follows the same pattern as the database settings in the previous article: without any email environment variables, you get the console backend, exactly as before, so a fresh clone of your repository still works with no configuration.
Once `EMAIL_HOST_USER` is set, Django sends real email through Mailgun instead.

- **`host`** is Mailgun's SMTP server. It defaults to the US region's server; if your Mailgun account is in the EU region, set `EMAIL_HOST=smtp.eu.mailgun.org` in your **.env** file.
- **`port`** is 587, the port for submitting mail to a mail service, which Google Cloud allows.
- **`use_tls`** makes Django upgrade the connection to an encrypted one (with the `STARTTLS` command) before it sends your password. Never send a password to an SMTP server without it.
- **`username`** and **`password`** are your Mailgun SMTP credentials, read from the environment, so that they never appear in your Git repository.
- **`timeout`** is how many seconds Django waits for Mailgun before giving up. Without it, a network problem makes the sign-up page hang until the browser gives up instead of showing an error.
- **`DEFAULT_FROM_EMAIL`** is the "From" address of every email the site sends, including allauth's.
  Use an address at your Mailgun domain, such as `LocalLibrary <library@mg.yourdomain.dev>`: the part before the `@` can be anything, but the domain must be the one you verified, or recipients' spam filters won't trust the message.

> [!NOTE]
> Don't add the older `EMAIL_BACKEND`, `EMAIL_HOST` or `EMAIL_HOST_USER` _settings_ that you may see in other tutorials: Django refuses to start if they are defined alongside `MAILERS`.
> We only use those names for our **environment variables**, which Django doesn't read by itself.

> [!NOTE]
> Mailgun also has an HTTP API, which [django-anymail](https://anymail.dev/) supports with an email backend of its own.
> It gives you extra features, such as finding out about bounced messages, but SMTP is simpler, and it's the same for every provider.

### Test it on your laptop

You can check that your credentials work before you deploy anything.
Your **settings.py** reads a **.env** file next to **manage.py**, if there is one, so add these lines to it (replacing the values with your own):

```bash
EMAIL_HOST_USER=locallibrary@mg.yourdomain.dev
EMAIL_HOST_PASSWORD=your-mailgun-smtp-password
DEFAULT_FROM_EMAIL=LocalLibrary <library@mg.yourdomain.dev>
```

> [!WARNING]
> Check that **.env** is listed in your **.gitignore** file before you save a password in it, and run `git status` to make sure that Git isn't about to commit it.
> If you ever do commit a password, pushing a new commit that deletes it isn't enough: it's still in your Git history, so delete the SMTP user in Mailgun and create a new one.

Django has a management command that sends a test email to the addresses you give it:

```bash
uv run python manage.py sendtestemail YOUR_EMAIL@example.com
```

If it works, the command prints nothing, and in a few seconds an email with a subject like "Test email from your-laptop on …" arrives (check the spam folder too).
You can also see each message, and whether it was delivered, under **Send › Reporting › Logs** in the Mailgun dashboard.
If it fails, it prints an error: see [Troubleshooting](#troubleshooting) below.

You can also sign up for a new account with `runserver`: the verification email now arrives in your inbox instead of the terminal.

Once it works, you can delete those lines from your laptop's **.env** again, if you'd rather keep using the console backend while you develop (and not use up your 100 emails a day).

### Commit and push

```bash
git add locallibrary_config/settings.py
git commit -m "Send email through Mailgun when EMAIL_HOST_USER is set"
git push
```

## Configure email on your VM

SSH to your VM and open your server's **.env** file:

```bash
gcloud compute ssh cs347-YOUR_EID --zone us-central1-c
cd /srv/apps
nano .env
```

Add the same variables to the end of it (and `EMAIL_HOST`, if your Mailgun account is in the EU region):

```bash
# --- Email -------------------------------------------------------------------
EMAIL_HOST_USER=locallibrary@mg.yourdomain.dev
EMAIL_HOST_PASSWORD=your-mailgun-smtp-password
DEFAULT_FROM_EMAIL=LocalLibrary <library@mg.yourdomain.dev>
```

Docker Compose passes every variable in **.env** to every app (that's what `env_file: [.env]` in **docker-compose.yml** does), so your other apps will send email with these settings too, once you add the same `MAILERS` code to them.
If you'd rather give each app its own SMTP user, set that app's variables in its `environment:` section in **docker-compose.yml** instead, which overrides **.env**.

Then pull your changes and recreate the container:

```bash
git -C locallibrary pull
docker compose up -d --build locallibrary
```

> [!NOTE]
> Environment variables are only read when a container is _created_, so `docker compose restart` doesn't pick up changes to **.env**.
> `docker compose up -d` does: it notices that the configuration has changed, and replaces the container.

Send yourself a test email from the running container:

```bash
docker compose exec locallibrary python manage.py sendtestemail YOUR_EMAIL@example.com
```

Then try the real thing: open `https://library.yourdomain.dev/accounts/signup/` in a private browser window, sign up with an email address that you can read, and click the link in the verification email.
Check that the link starts with `https://library.yourdomain.dev/`; if it starts with `http://` or with a different hostname, see [Troubleshooting](#troubleshooting).

The superuser you created on the server doesn't have a verified email address yet, so the site's login page will ask it to verify one first.
Now that email works, it can: log in to the site with your superuser's username, and allauth sends the verification email.

## Getting emails about errors

With `DEBUG=False`, Django can email the details of every server error ("Server Error (500)") to the site's administrators, so you find out about problems before your users tell you.
Add the following to **settings.py**, below the email settings:

```python
# Who gets an email when the site has a server error.
ADMINS = env.list('ADMINS', default=[])
```

Commit, push and redeploy, then add your own address to the server's **.env**, and run `docker compose up -d locallibrary` again:

```bash
ADMINS=you@example.com
```

Check that it works with:

```bash
docker compose exec locallibrary python manage.py sendtestemail --admins
```

On your laptop, `ADMINS` is empty and `DEBUG` is `True`, so you'll keep seeing errors in the browser instead.

## Using the sandbox domain

If you don't want to give Mailgun a credit card, you can still try all of this with the _sandbox domain_ that Mailgun creates for every account (it looks like `sandbox0123456789abcdef.mailgun.org`).
You don't need any DNS records for it, but it can only send to at most five _authorized recipients_: addresses that you add on the domain's overview page, and whose owners have clicked a confirmation link that Mailgun sends them.

That's enough to test sign-up and password reset with your own addresses, but not to let anyone else sign up for your site.

To use it, follow the steps above, but choose the sandbox domain instead of `mg.yourdomain.dev`: create an SMTP user for it, and use an address at the sandbox domain (for example, `library@sandbox0123456789abcdef.mailgun.org`) for `DEFAULT_FROM_EMAIL`.

## Troubleshooting

Email errors are printed by `sendtestemail` itself.
When the site sends email (for example, from the sign-up page), the error appears in `docker compose logs locallibrary` instead, as long as you've added the [`LOGGING` setting](/en-US/docs/Learn_web_development/Extensions/Server-side/Django/Deployment#reading_the_logs) from the previous article.
If Django sent the message without an error, Mailgun's **Send › Reporting › Logs** page shows what happened to it next.

| Problem                                                                     | Likely cause                                                                                                                                                                                                        |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Emails are still printed in the logs instead of sent                        | `EMAIL_HOST_USER` isn't set inside the container. Check **.env**, then run `docker compose up -d locallibrary` (not `restart`). `docker compose exec locallibrary env \| grep EMAIL` shows what the container sees. |
| `SMTPAuthenticationError: (535, … Authentication failed)`                   | The SMTP username or password is wrong (use the full username, including `@mg.yourdomain.dev`), the SMTP user was deleted, or your account is in the EU region and `EMAIL_HOST` isn't set to `smtp.eu.mailgun.org`. |
| `TimeoutError` or `Connection refused`                                      | Django isn't connecting to Mailgun on port 587. Check `host` and `port` in **settings.py**. (Port 25 always times out on Google Cloud.)                                                                             |
| `SMTPSenderRefused` or `SMTPServerDisconnected` straight after connecting   | `use_tls` is missing or `False`.                                                                                                                                                                                    |
| Mailgun says the domain is unverified                                       | The DNS records aren't visible yet, or don't match. Check them with MxToolbox, and look for a doubled-up name such as `mg.yourdomain.dev.yourdomain.dev`.                                                           |
| `Domain … is not allowed to send: Free accounts are for test purposes only` | You're using the sandbox domain, and the recipient isn't an authorized recipient. Add and confirm the address, or [use your own domain](#add_your_sending_domain).                                                  |
| Links in the emails start with `http://` instead of `https://`              | `SECURE_PROXY_SSL_HEADER` is missing from **settings.py**, so Django thinks that the request arrived over HTTP.                                                                                                     |
| Emails arrive in the spam folder                                            | `DEFAULT_FROM_EMAIL` isn't an address at your verified Mailgun domain, or the domain's SPF and DKIM records aren't verified.                                                                                        |
| `sendtestemail` succeeds, but no email arrives                              | Check the recipient's spam folder, then Mailgun's **Logs** page: it says whether the message was delivered, and if not, why (for example, a mistyped address).                                                      |
| Mailgun rejects messages after a while                                      | You've hit the free plan's daily limit. Wait until tomorrow. If a bot is signing up for accounts on your site, that's what's using your limit.                                                                      |

## Summary

Your deployed _LocalLibrary_ now sends real email, so people can sign up for accounts, verify their email addresses, and reset their passwords without your help.
Along the way you've seen how Django's `MAILERS` setting lets every part of your site send email through one configuration, how to keep the console backend for development and use SMTP in production with the same environment-variable pattern as the database, how SPF and DKIM records let other mail servers trust your site's email, and why credentials like SMTP passwords belong in **.env** and not in Git.

## See also

- [Sending email](https://docs.djangoproject.com/en/6.1/topics/email/) (Django docs)
- [`sendtestemail`](https://docs.djangoproject.com/en/6.1/ref/django-admin/#sendtestemail) and [`ADMINS`](https://docs.djangoproject.com/en/6.1/ref/settings/#admins) (Django docs)
- [Sending email from an instance](https://cloud.google.com/compute/docs/tutorials/sending-mail) (Google Cloud docs)
- [Mailgun documentation](https://documentation.mailgun.com/) and [Mailgun help center](https://help.mailgun.com/)
- [Email](https://docs.allauth.org/en/latest/common/email.html) (django-allauth docs)

{{PreviousMenuNext("Learn_web_development/Extensions/Server-side/Django/Deployment", "Learn_web_development/Extensions/Server-side/Django/web_application_security", "Learn_web_development/Extensions/Server-side/Django")}}
