---
title: "Django Tutorial Part 11: Deploying Django to production"
short-title: "11: Deploying"
slug: Learn_web_development/Extensions/Server-side/Django/Deployment
page-type: learn-module-chapter
sidebar: learnsidebar
---

{{PreviousMenuNext("Learn_web_development/Extensions/Server-side/Django/Testing", "Learn_web_development/Extensions/Server-side/Django/web_application_security", "Learn_web_development/Extensions/Server-side/Django")}}

You've already created and tested an example website using Django, so now it's time to install it on a web server so that it can be accessed by anyone over the public internet.
This page shows you how to deploy the _LocalLibrary_ website to a virtual machine on Google Cloud, using Docker Compose, Postgres, and the Caddy web server.

<!-- markdownlint-disable search-replace -->

> [!NOTE]
> This page has been rewritten for our course to deploy to Google Cloud.
> The [original MDN version of this page](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Server-side/Django/Deployment) explains how to deploy to [PythonAnywhere](https://www.pythonanywhere.com/) and [Railway](https://railway.com/) instead.
> [Our fork's earlier version of this page](https://github.com/CS-347-F26/mdn-content/blob/ee9f3a473f3a621d3ca5835eab137c81ec7034cb/files/en-us/learn_web_development/extensions/server-side/django/deployment/index.md) has the same PythonAnywhere and Railway content, adapted to the rest of our fork of the tutorial (for example, using `uv` and the **locallibrary_config** project folder).

<!-- markdownlint-enable search-replace -->

<table>
  <tbody>
    <tr>
      <th scope="row">Prerequisites:</th>
      <td>
        Complete all previous tutorial topics, including <a href="/en-US/docs/Learn_web_development/Extensions/Server-side/Django/Testing">Django Tutorial Part 10: Testing a Django web application</a>.
      </td>
    </tr>
    <tr>
      <th scope="row">Objective:</th>
      <td>To learn how to prepare a Django app for production, and deploy it to a server of your own.</td>
    </tr>
  </tbody>
</table>

## Overview

Up to now you've been working in a development environment: the Django development web server, an SQLite database, and settings (such as `DEBUG = True`) that expose information that is useful to you, and to attackers.
In this tutorial you'll set up a production environment on a Google Cloud virtual machine (VM), and deploy _LocalLibrary_ to it.

Your VM will run:

- **Docker Compose**, which runs each part of the site in its own container, all described in one **docker-compose.yml** file.
- **One Postgres database server**, with a separate database for each app.
- **[Caddy](https://caddyserver.com/)**, a web server that receives every request and forwards it to the right app.
  Caddy also gets HTTPS certificates from [Let's Encrypt](https://letsencrypt.org/) automatically, and renews them for you.
- **Up to five Django apps**, each on its own subdomain (for example, `https://library.yourdomain.dev`).
- **Redis**, which the Channels chat in _LocalLibrary_ uses as its channel layer.

You'll keep developing with SQLite on your laptop, and deploy changes with `git push` and one command on the server.

These instructions deploy _LocalLibrary_ only.
The server is already set up for your other apps (kahduke and your final project), and the steps for those will be added later.

> [!NOTE]
> All of the files used on this page are in the [CS-347-F26/google-cloud](https://github.com/CS-347-F26/google-cloud) repository.
> An [interactive version of these instructions](https://cs-347-f26.github.io/google-cloud/) lets you enter your eID, domain and IP address once, and fills them in to every command for you.

## Prerequisites

- A Google Cloud account with access to a billing account.
- The [`gcloud` CLI](https://cloud.google.com/sdk/docs/install) installed.
- A domain name (the one you created earlier in the semester for free with the GitHub Student Developer Pack).
- Your _LocalLibrary_ app pushed to a Git repository that you can clone on the VM.

Throughout this page, replace `YOUR_EID` with your JMU eID, `yourdomain.dev` with your domain, and so on.

## Prepare LocalLibrary for deployment

Do this on your laptop, in your _LocalLibrary_ repository, **before** you touch Google Cloud.

### Production dependencies

Production needs a Postgres driver ([psycopg](https://www.psycopg.org/)) and a production web server ([Gunicorn](https://gunicorn.org/)) that your laptop doesn't.
Put them in a `prod` dependency group, so that they're only installed inside the Docker image:

```bash
uv add --group prod "psycopg[binary]" gunicorn
```

You don't need to add Daphne or `channels-redis` here: the Channels tutorial already added both as regular dependencies.

Next, add [WhiteNoise](https://whitenoise.readthedocs.io/), which serves your CSS and JavaScript in production, and [django-environ](https://django-environ.readthedocs.io/), which reads settings from environment variables.
These are regular dependencies, not part of the `prod` group, because **settings.py** uses them, so they have to be installed on your laptop too:

```bash
uv add whitenoise django-environ
```

### Reading settings from the environment

Some settings must be different in production, and some must be secret:

- `DEBUG` must be `False` in production, so that error pages don't show your code and settings to visitors.
- `SECRET_KEY` is used to sign cookies and protect against CSRF, so the production key must not be in your Git repository.

The usual way to handle this is to read these settings from _environment variables_, falling back to development defaults when a variable isn't set.
On the server, Docker Compose sets the environment variables from a **.env** file that only exists on the server.

If your **locallibrary_config/settings.py** doesn't already read settings with django-environ (the Channels tutorial sets this up), add the following code after `BASE_DIR` is defined, and replace the existing `SECRET_KEY` and `DEBUG` lines:

```python
import environ

env = environ.Env()
# Read a .env file next to manage.py, if there is one. Real environment variables win.
environ.Env.read_env(BASE_DIR / '.env')

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = env('SECRET_KEY', default='django-insecure-keep-your-existing-key-here')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = env.bool('DEBUG', default=True)
```

### Database configuration

Replace the `DATABASES` dictionary in **settings.py** with the following:

```python
DATABASES = {
    "default": env.db(default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}")
}
```

`env.db()` reads a database URL from the `DATABASE_URL` environment variable.
On your laptop `DATABASE_URL` isn't set, so you get SQLite, with no setup and no Postgres install.
On the server, Docker Compose sets `DATABASE_URL` to point at the Postgres container.

### Hosts and HTTPS

Replace `ALLOWED_HOSTS` and `CSRF_TRUSTED_ORIGINS` with the following:

```python
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])
CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS", default=[])
```

Then add this line, so that Django knows that requests arrive over HTTPS:

```python
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
```

Caddy handles the HTTPS connection with the browser, and forwards each request to Django over plain HTTP inside the VM.
Without this line, Django thinks that every request is insecure, and you will get CSRF errors when you log in (and an infinite redirect loop if you set `SECURE_SSL_REDIRECT`).

### Static files

With `DEBUG=False`, Django stops serving static files, so without some extra setup your deployed site loads with no CSS.

Check that **settings.py** sets `STATIC_ROOT` (you added it in [Django Tutorial Part 2: Creating a skeleton website](/en-US/docs/Learn_web_development/Extensions/Server-side/Django/skeleton_website#hooking_up_the_url_mapper)).
This is where `collectstatic` gathers your static files, and the Docker build fails without it:

```python
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
```

Then add WhiteNoise to `MIDDLEWARE`, directly after `SecurityMiddleware`:

```python
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    # …the rest unchanged
]
```

WhiteNoise serves the files in `STATIC_ROOT` from Django itself, efficiently enough for production.
It doesn't serve the files that users upload: we'll set those up in [Media files](#media_files) below.

### Add a Dockerfile

Copy [Dockerfile.example](https://github.com/CS-347-F26/google-cloud/blob/main/Dockerfile.example) into your _LocalLibrary_ repository as **Dockerfile**.
It describes how to build an _image_ of your app: a Python environment with your dependencies and code installed, that Docker Compose runs on the server.

The build runs `collectstatic`, which loads **settings.py**.
Your **.env** file is not in the image, so the Dockerfile gives `REDIS_URL` a placeholder value just for the build; the running app gets the real address from Docker Compose.
Check that its `collectstatic` line reads:

```plain
RUN REDIS_URL=redis://build-placeholder:6379 python manage.py collectstatic --noinput
```

Then replace its `CMD` line with the following one, which runs your app with Daphne (rather than Gunicorn), so that Channels works:

```plain
CMD ["sh", "-c", "python manage.py migrate --noinput && exec daphne -b 0.0.0.0 -p 8000 locallibrary_config.asgi:application"]
```

Notice that the container runs `migrate` every time it starts, so there's no separate step to migrate the production database when you deploy.

### Commit and push

Make sure that everything still works locally (`uv run python manage.py runserver`), then commit and push:

```bash
git add pyproject.toml uv.lock Dockerfile locallibrary_config/settings.py
git commit -m "Add production config for Google Cloud deployment"
git push
```

From here on, everything happens in Google Cloud.

## Create your Google Cloud project

Log in, and create a project using `cs347f26-YOUR_EID` as the project ID:

```bash
gcloud auth login
gcloud projects create cs347f26-YOUR_EID --name="CS 347 - YOUR_EID"
gcloud config set project cs347f26-YOUR_EID
```

Then link a billing account to the project, so that you can use Compute Engine.
List your billing accounts to find the ID:

```bash
gcloud billing accounts list
```

Copy the account ID (it looks like `XXXXXX-XXXXXX-XXXXXX`; you probably want the one named `Billing Account for Education`), and link it to your project:

```bash
gcloud billing projects link cs347f26-YOUR_EID --billing-account=BILLING_ACCOUNT_ID
```

## Create your VM

On your laptop, clone the google-cloud repository and run its setup script with your JMU eID:

```bash
git clone https://github.com/CS-347-F26/google-cloud.git
cd google-cloud
./create-vm.sh YOUR_EID
```

> [!NOTE]
> On Windows, run **create-vm.sh** from Git Bash, not from Command Prompt or PowerShell.
> (This is worth remembering for any file whose name ends in **.sh**.)

The script reserves a static IP address, opens ports 80 and 443, and creates a Debian VM that installs Docker for itself when it first boots.
It prints your static IP address when it finishes: make a note of it, because you need it for DNS.

If you lose track of your static IP address later, print it again with:

```bash
gcloud compute addresses describe cs347-YOUR_EID-ip --region us-central1 --format='value(address)'
```

Wait about 60 seconds for the VM to finish installing Docker.
You can watch it happen with:

```bash
gcloud compute ssh cs347-YOUR_EID --zone us-central1-c \
  --command 'sudo journalctl -u google-startup-scripts -f'
```

## Set up DNS

At your domain registrar, add **one** wildcard `A` record that points every subdomain of your domain at your VM:

```plain
*.yourdomain.dev    A    YOUR_STATIC_IP
```

> [!WARNING]
> The IP address should **not** start with `10.` — that is the VM's internal IP address.
> Use the external IP address that **create-vm.sh** printed.

This single record covers every app you'll ever add.
Check that it works before you continue: open [MxToolbox DNS Lookup](https://mxtoolbox.com/DNSLookup.aspx), choose **A Lookup**, and look up `library.yourdomain.dev`.
The result should show your static IP address; if no record is found, wait a few minutes and try again.

**Don't start the containers until DNS is working.**
Caddy requests an HTTPS certificate the first time each hostname is used, and that fails if DNS isn't live yet.

## SSH into your VM

```bash
gcloud compute ssh cs347-YOUR_EID --zone us-central1-c
```

The first time you log in, the VM adds you to the `docker` group.
**Log out and back in once** for that to take effect:

```bash
exit
gcloud compute ssh cs347-YOUR_EID --zone us-central1-c
```

Check that Docker works without `sudo`:

```bash
docker ps
```

You should see an empty list of containers:

```plain
CONTAINER ID   IMAGE     COMMAND   CREATED   STATUS    PORTS     NAMES
```

### Set up SSH config for direct access

`gcloud compute ssh` works, but you can also set up the plain `ssh`, `scp` and `rsync` commands to connect to your VM.
First, find your OS Login username:

```bash
gcloud compute os-login describe-profile --format='value(posixAccounts[0].username)'
```

It will look something like `stewarmc_jmu_edu`.
Add an entry for your VM to **~/.ssh/config** on your laptop:

```plain
Host cs347-YOUR_EID
    HostName YOUR_STATIC_IP
    User YOUR_OS_LOGIN_USERNAME
    IdentityFile ~/.ssh/google_compute_engine
```

(The key in **~/.ssh/google_compute_engine** was created by your first `gcloud compute ssh`.)

Now you can use the standard tools from your laptop, for example:

- `ssh cs347-YOUR_EID` to get a terminal on the VM.
- `scp SOME_FILES cs347-YOUR_EID:/some/path/` to copy files to the VM.
- `rsync -av SOME_DIR/ cs347-YOUR_EID:/SOME_REMOTE_DIR/` to sync a directory to the VM.

## Copy the deployment files and clone LocalLibrary

From the **google-cloud** folder on your laptop, copy the deployment files ([docker-compose.yml](https://github.com/CS-347-F26/google-cloud/blob/main/docker-compose.yml), [Caddyfile](https://github.com/CS-347-F26/google-cloud/blob/main/Caddyfile), [init-databases.sql](https://github.com/CS-347-F26/google-cloud/blob/main/init-databases.sql), [env.example](https://github.com/CS-347-F26/google-cloud/blob/main/env.example) and [Dockerfile.example](https://github.com/CS-347-F26/google-cloud/blob/main/Dockerfile.example)) to **/srv/apps** on the VM:

```bash
scp Dockerfile.example docker-compose.yml Caddyfile init-databases.sql env.example cs347-YOUR_EID:/srv/apps
```

Then SSH to the VM, and change to that folder:

```bash
ssh cs347-YOUR_EID
cd /srv/apps
```

Clone your _LocalLibrary_ repository next to the deployment files, into a folder named **locallibrary**:

```bash
git clone YOUR_LOCALLIBRARY_REPO locallibrary
```

Your **/srv/apps** folder should now look like this:

```plain
/srv/apps/
  .env                ← you create this next
  Caddyfile
  Dockerfile.example
  docker-compose.yml
  env.example
  init-databases.sql
  locallibrary/       ← your app repository
```

Here's what each of these files does:

- **docker-compose.yml** lists the containers to run: Caddy, Postgres, Redis, and one container for each app.
  The apps aren't reachable from the internet directly: only Caddy is.
- **Caddyfile** tells Caddy which hostname belongs to which app.
- **init-databases.sql** creates one Postgres database for each app, the first time Postgres starts.
- **.env** holds your settings and secrets. It is the only file that is different for each student.

## Configure your environment

```bash
cp env.example .env
nano .env
```

Fill in your values:

| Variable               | What to put                                                                                                |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| `SECRET_KEY`           | A long random string (run `python3 -c "import secrets; print(secrets.token_urlsafe(50))"` to generate one) |
| `ACME_EMAIL`           | Your email address (Let's Encrypt sends certificate warnings here)                                         |
| `LOCALLIBRARY_HOST`    | `library.yourdomain.dev`                                                                                   |
| `KAHDUKE_HOST`         | `kahduke.yourdomain.dev`                                                                                   |
| `FINAL_PROJECT_HOST`   | `finalproject.yourdomain.dev`                                                                              |
| `ALLOWED_HOSTS`        | `.yourdomain.dev`                                                                                          |
| `CSRF_TRUSTED_ORIGINS` | `https://*.yourdomain.dev`                                                                                 |
| `POSTGRES_PASSWORD`    | A strong password (it is only used between containers)                                                     |

Fill in `KAHDUKE_HOST` and `FINAL_PROJECT_HOST` now, even though those apps aren't deployed yet.
Caddy reads all three hostnames: if one is blank or missing Caddy won't start at all, and if you leave the example values in, it tries to get certificates for a domain you don't own.
Each hostname must be different.

The leading dot in `.yourdomain.dev` means "this domain and all of its subdomains", so `ALLOWED_HOSTS` covers every app you'll ever add.

**Don't** set `DATABASE_URL` in **.env**.
Docker Compose sets a different one for each app, and leaving it out of **.env** is what makes SQLite work on your laptop.

## Start LocalLibrary

> [!WARNING]
> Don't run the command below until the [MxToolbox lookup](#set_up_dns) shows `library.yourdomain.dev` resolving to your static IP address.
> If DNS isn't live, Caddy can't get your certificates, and repeated failures can get you rate-limited by Let's Encrypt.

```bash
docker compose up -d --build caddy locallibrary
```

This builds the image for _LocalLibrary_, starts Postgres and Redis, runs your migrations, and starts Caddy.
Name the two services as shown: a bare `docker compose up` would also try to build kahduke and final_project, which you haven't cloned, and fail.
The first launch takes a few minutes, because Docker has to download the base images and build everything from scratch.

Check that everything is running:

```bash
docker compose ps
docker compose logs -f
```

Once Caddy has obtained a certificate (you'll see log lines about it; press <kbd>Ctrl</kbd>+<kbd>C</kbd> to stop following the logs), visit your app at `https://library.yourdomain.dev`.

## Create a superuser

Your deployed site has a new, empty Postgres database, so none of the users or books from your laptop exist there.
From **/srv/apps** on the VM, create an admin account:

```bash
docker compose exec locallibrary python manage.py createsuperuser
```

Then log in at `https://library.yourdomain.dev/admin/`.

> [!WARNING]
> **Don't reuse a username and password like `me`/`me`.**
> That was fine on your laptop, but this site is on the public internet, and bots start trying common usernames and passwords on new sites within hours.
> Use a real username and a long, randomly generated password.

Save that password in a password manager.
As a student you can get [2 years of 1Password free](https://1password.com/developers/students).

## Media files

If you completed [Django Tutorial Part 9.5: Media files and user uploads](/en-US/docs/Learn_web_development/Extensions/Server-side/Django/Media_files), your site lets staff upload book covers and author photos.
These need two more changes on the server:

- **Somewhere to keep them.** Each time you run `docker compose up --build`, Docker replaces your app's container with a new one, and any files saved inside the old container are lost.
  So we store `MEDIA_ROOT` (**/app/media** inside the container) in a Docker _volume_, which survives rebuilds, just like the Postgres data.
- **Something to serve them.** With `DEBUG=False`, Django doesn't serve media files, and WhiteNoise only serves static files.
  We'll have Caddy serve them directly from the same volume.

On the VM, open **/srv/apps/docker-compose.yml** and add a `volumes` entry to the `locallibrary` service, and a read-only one to the `caddy` service:

```yaml
services:
  caddy:
    # …
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
      - locallibrary_media:/srv/media/locallibrary:ro

  # …

  locallibrary:
    # …
    volumes:
      - locallibrary_media:/app/media
```

Then add the new volume to the `volumes` list at the bottom of the file:

```yaml
volumes:
  caddy_data:
  caddy_config:
  pg_data:
  locallibrary_media:
```

Next, open **/srv/apps/Caddyfile** and replace the `{$LOCALLIBRARY_HOST}` block with the following:

```plain
{$LOCALLIBRARY_HOST} {
  handle_path /media/* {
    root * /srv/media/locallibrary
    file_server
  }
  handle {
    reverse_proxy locallibrary:8000
  }
}
```

Requests for URLs starting with `/media/` are now answered by Caddy from the volume (`handle_path` removes the `/media` prefix before looking for the file), and every other request is forwarded to Django as before.

Finally, recreate both containers:

```bash
docker compose up -d --build caddy locallibrary
```

Upload a book cover on the live site to check that it works, then run `docker compose up -d --build locallibrary` again and check that the cover is still there.

## Deploying updates

After you push changes to your _LocalLibrary_ repository, deploy them like this:

```bash
gcloud compute ssh cs347-YOUR_EID --zone us-central1-c
cd /srv/apps
git -C locallibrary pull
docker compose up -d --build locallibrary
```

Migrations run automatically when the container starts, so there's no separate step for them.

## Backups

Dump all of your databases to a file:

```bash
docker compose exec postgres pg_dumpall -U cs347 > ~/backup-$(date +%F).sql
```

If your site has media files, copy them out of the container too:

```bash
docker compose cp locallibrary:/app/media ~/media-backup-$(date +%F)
```

The Postgres data volume (and the media volume) survive `docker compose down`, reboots and rebuilds.
They do **not** survive `docker compose down -v`: that flag deletes all volumes, including your databases. Don't use it.

## Troubleshooting

### Reading the logs

Most problems show up in a container's logs.
SSH to your VM and run these commands from **/srv/apps**.

First, check which containers are running.
A container showing `Exited` or `Restarting` has crashed, and its logs say why:

```bash
docker compose ps -a
```

**Caddy** logs certificate problems (DNS, Let's Encrypt) and failures to reach your app:

```bash
docker compose logs --tail 50 caddy
```

**Django** (the `locallibrary` container) logs migration errors at startup, each request, and Python tracebacks:

```bash
docker compose logs --tail 100 locallibrary
```

To watch the logs live while you reload the page in your browser, add `-f` (and press <kbd>Ctrl</kbd>+<kbd>C</kbd> to stop):

```bash
docker compose logs -f caddy locallibrary
```

Build errors (for example, a failing `collectstatic`) aren't in the logs.
They're printed by the `docker compose up -d --build` command itself, so scroll up in its output.

With `DEBUG=False`, Django doesn't print tracebacks by default: the page shows "Server Error (500)", and the log only shows the request.
Add the following to the bottom of **settings.py** so that errors appear in `docker compose logs`, then commit, push and redeploy:

```python
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": "WARNING"},
}
```

### Common problems

| Problem                                                       | Likely cause                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browser says it can't connect (no error page at all)          | Caddy isn't running. Run `docker compose ps -a`; if `caddy` is missing or exited, check `docker compose logs caddy` and run `docker compose up -d --build caddy locallibrary` again.                                                                                                                                                                                                                                         |
| `caddy` shows `Restarting` in `docker compose ps`             | A bad value in **.env**. Run `docker compose logs --tail 5 caddy` and match the error: `server block without any key is global configuration` means a `*_HOST` variable is blank or missing; `ambiguous site definition` means two `*_HOST` variables have the same value, or one contains a space; `wrong argument count … after 'email'` means `ACME_EMAIL` is blank. Fix **.env**, then run `docker compose up -d caddy`. |
| 502 Bad Gateway                                               | Caddy is running but `locallibrary` isn't. Check `docker compose logs locallibrary` for a crash or a failed migration.                                                                                                                                                                                                                                                                                                       |
| "Server Error (500)"                                          | A Python exception. Find the traceback with `docker compose logs locallibrary` (this needs the [`LOGGING` setting](#reading_the_logs)).                                                                                                                                                                                                                                                                                      |
| CSRF errors when logging in                                   | `SECURE_PROXY_SSL_HEADER` is missing from **settings.py**.                                                                                                                                                                                                                                                                                                                                                                   |
| Infinite redirect loop                                        | `SECURE_SSL_REDIRECT = True` without `SECURE_PROXY_SSL_HEADER`.                                                                                                                                                                                                                                                                                                                                                              |
| Build fails at `collectstatic`                                | `STATIC_ROOT` is missing from **settings.py**.                                                                                                                                                                                                                                                                                                                                                                               |
| Build fails with `Set the REDIS_URL environment variable`     | Your Dockerfile has an old `collectstatic` line; [update it](#add_a_dockerfile).                                                                                                                                                                                                                                                                                                                                             |
| Redis connection errors, or chat doesn't work                 | `CHANNEL_LAYERS` still says `127.0.0.1` instead of reading `REDIS_URL` (see [Part 2 of the Channels tutorial](https://w3.cs.jmu.edu/cs347/f26/activities/channels-tutorial/part-2/)).                                                                                                                                                                                                                                        |
| Site loads with no CSS                                        | WhiteNoise isn't in `MIDDLEWARE`.                                                                                                                                                                                                                                                                                                                                                                                            |
| Uploaded images show as broken links                          | Caddy isn't serving `/media/`: check the [media file](#media_files) changes to **docker-compose.yml** and **Caddyfile**.                                                                                                                                                                                                                                                                                                     |
| Uploaded images disappear after a deploy                      | The `locallibrary_media` volume isn't mounted at **/app/media** in the `locallibrary` service.                                                                                                                                                                                                                                                                                                                               |
| TLS or certificate errors                                     | DNS doesn't resolve yet, or port 80 is blocked.                                                                                                                                                                                                                                                                                                                                                                              |
| `Killed` during `docker compose build`                        | The swap file is missing. Check that the VM's startup script ran.                                                                                                                                                                                                                                                                                                                                                            |
| Browser refuses plain HTTP                                    | `.dev` domains are on the browsers' HSTS preload list, so you must use `https://`.                                                                                                                                                                                                                                                                                                                                           |
| New database not created after editing **init-databases.sql** | That file only runs the first time Postgres starts. Use `docker compose exec postgres createdb -U cs347 dbname` instead.                                                                                                                                                                                                                                                                                                     |

## Tearing down

When the semester is over, the cleanest way to remove everything is to delete the whole project:

```bash
gcloud projects delete cs347f26-YOUR_EID
```

This removes the VM, its disk and the static IP address in one step.

## Summary

You've now got _LocalLibrary_ running on the public internet, on a server you control, with HTTPS and a production database.
Along the way you've seen how to change a Django app's settings for production (reading them from environment variables, turning off `DEBUG`, and keeping `SECRET_KEY` out of Git), how to serve static and media files when Django's development server isn't doing it for you, and how Docker Compose and a reverse proxy let you run several apps on one machine.

The next step is to read our last few articles, and then complete the assessment task.

## See also

- [Deploying Django](https://docs.djangoproject.com/en/6.1/howto/deployment/) (Django docs)
  - [Deployment checklist](https://docs.djangoproject.com/en/6.1/howto/deployment/checklist/) (Django docs)
  - [Deploying static files](https://docs.djangoproject.com/en/6.1/howto/static-files/deployment/) (Django docs)
- [CS-347-F26/google-cloud](https://github.com/CS-347-F26/google-cloud) (the deployment files used on this page, and an instructor's README explaining the design)
- [Docker Compose](https://docs.docker.com/compose/) (Docker docs)
- [Caddyfile concepts](https://caddyserver.com/docs/caddyfile/concepts) and [`reverse_proxy`](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy) (Caddy docs)
- [Compute Engine documentation](https://cloud.google.com/compute/docs) (Google Cloud docs)
- [WhiteNoise](https://whitenoise.readthedocs.io/) and [django-environ](https://django-environ.readthedocs.io/) (package docs)

{{PreviousMenuNext("Learn_web_development/Extensions/Server-side/Django/Testing", "Learn_web_development/Extensions/Server-side/Django/web_application_security", "Learn_web_development/Extensions/Server-side/Django")}}
