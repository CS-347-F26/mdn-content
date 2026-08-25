---
title: Setting up a Django development environment
short-title: Dev environment setup
slug: Learn_web_development/Extensions/Server-side/Django/development_environment
page-type: learn-module-chapter
sidebar: learnsidebar
---

{{PreviousMenuNext("Learn_web_development/Extensions/Server-side/Django/Introduction", "Learn_web_development/Extensions/Server-side/Django/Tutorial_local_library_website", "Learn_web_development/Extensions/Server-side/Django")}}

Now that you know what Django is for, we'll show you how to set up and test a Django development environment on Windows, Linux (Ubuntu), and macOS — whatever common operating system you are using, this article should give you what you need to be able to start developing Django apps.

<table>
  <tbody>
    <tr>
      <th scope="row">Prerequisites:</th>
      <td>
        Basic knowledge of using a terminal/command line and how to install software packages on your development computer's operating system.
      </td>
    </tr>
    <tr>
      <th scope="row">Objective:</th>
      <td>
        To have a development environment for Django (6.1) running on your computer.
      </td>
    </tr>
  </tbody>
</table>

## Django development environment overview

Django makes it very easy to set up your own computer so that you can start developing web applications. This section explains what you get with the development environment, and provides an overview of some of your setup and configuration options. The remainder of the article explains the _recommended_ method of installing the Django development environment on Ubuntu, macOS, and Windows, and how you can test it.

### What is the Django development environment?

The development environment is an installation of Django on your local computer that you can use for developing and testing Django apps prior to deploying them to a production environment.

The main tools that Django itself provides are a set of Python scripts for creating and working with Django projects, along with a simple _development web server_ that you can use to test local (i.e., on your computer, not on an external web server) Django web applications on your computer's web browser.

There are other peripheral tools, that often form part of the development environment, that we won't be covering here. These include things like a [text editor](/en-US/docs/Learn_web_development/Howto/Tools_and_setup/Available_text_editors) or IDE for editing code, linters for auto formatting, and so on. We are assuming that you've already got a text editor installed.

### What are the Django setup options?

Django is extremely flexible in terms of how and where it can be installed and configured. Django can be:

- Installed on different operating systems.
- Installed from source, from the Python Package Index (PyPi) and in many cases from the host computer's package manager application.
- Configured to use one of several databases, which may also need to be separately installed and configured.
- Run in the main system Python environment or within separate Python virtual environments.

Each of these options requires a slightly different configuration and setup. The following subsections explain some of your choices. For the rest of the article, we'll show you how to set up Django on a small number of operating systems, and that setup will be assumed throughout the rest of this module.

> [!NOTE]
> Other possible installation options are covered in the official Django documentation. We link to the [appropriate documents below](#see_also).

#### What operating systems are supported?

Django web applications can be run on almost any machine that can run the Python 3 programming language: Windows, macOS, Linux/Unix, Solaris, to name just a few.
Almost any computer should have the necessary performance to run Django during development.

In this article, we'll provide instructions for Windows, macOS, and Linux/Unix.

#### What version of Python should be used?

You can use any Python version supported by your target Django release.
For Django 6.1 the allowed versions are Python 3.12, 3.13, and 3.14 (see [FAQ:Installation](https://docs.djangoproject.com/en/6.1/faq/install/#what-python-version-can-i-use-with-django)).

The Django project _recommends_ (and "officially supports") using the newest available version of the supported Python release, which at the time of writing is Python 3.14.

#### Where can we download Django?

There are three places to download Django:

- The Python Package Repository (PyPi), using the _pip_ tool. This is the best way to get the latest stable version of Django.
- Use a version from your computer's package manager. Distributions of Django that are bundled with operating systems offer a familiar installation mechanism. Note however that the packaged version may be quite old, and can only be installed into the system Python environment (which may not be what you want).
- Install from source. You can get and install the latest bleeding-edge version of Django from the source. This is not recommended for beginners but is needed when you're ready to start contributing back to Django itself.

This article shows how to install Django from PyPi, in order to get the latest stable version.

#### Which database?

Django officially supports the PostgreSQL, MariaDB, MySQL, Oracle, and SQLite databases, and there are community libraries that provide varying levels of support for other popular SQL and NoSQL databases. We recommend that you select the same database for both production and development (although Django abstracts many of the database differences using its Object-Relational Mapper (ORM), there are still [potential issues](https://docs.djangoproject.com/en/6.1/ref/databases/) that are better to avoid).

For this article (and most of this module) we will be using the _SQLite_ database, which stores its data in a file. SQLite is intended for use as a lightweight database and can't support a high level of concurrency. It is, however, an excellent choice for applications that are primarily read-only.

> [!NOTE]
> Django is configured to use SQLite by default when you start your website project using the standard tools (`python -m django startproject`). It's a great choice when you're getting started because it requires no additional configuration or setup.

#### Installing system-wide or in a Python virtual environment?

When you install Python you get a single global environment that is shared by all Python code on the computer. While you can install whatever Python packages you like into that environment, you can only install one particular version of each package at a time.

> [!NOTE]
> Python applications installed into the global environment can potentially conflict with each other (i.e., if they depend on different versions of the same package).

If you install Django into the default/global environment then you will only be able to target one version of Django on the computer. This can be a problem if you want to create new websites (using the latest version of Django) while still maintaining websites that rely on older versions.

As a result, experienced Python/Django developers typically run Python apps within independent _Python virtual environments_. This enables multiple different Django environments on a single computer. The Django developer team itself recommends that you use Python virtual environments!

This module assumes that you've installed Django into a virtual environment, created with the standard library's `venv` module in a folder named **.venv** at the root of the project it belongs to. We'll show you how below.

## Installing Python 3

In order to use Django you must have Python 3 on your operating system.
You will also need the [Python Package Index](https://pypi.org/) tool — _pip_ — which is used to manage (install, update, and remove) Python packages/libraries used by Django and your other Python apps.

Django 6.1 runs on Python 3.12, 3.13, and 3.14 (see [FAQ: Installation](https://docs.djangoproject.com/en/6.1/faq/install/#what-python-version-can-i-use-with-django)).
The Django project _recommends_ (and "officially supports") the newest available version of the supported Python releases, which at the time of writing is Python 3.14.

Throughout this module we invoke the interpreter and its package manager using the bare commands `python` and `pip`, on every operating system.
This works everywhere once you have [activated a virtual environment](#using_a_virtual_environment), because the environment puts its own `python` and `pip` at the front of your path.
The one command that runs _before_ any environment exists is the one that creates it, so start by making sure the bare `python` command already resolves to a Python 3.12+ installation.

> [!NOTE]
> If `python -V` reports "command not found", the interpreter is installed but only reachable under a version-qualified name.
> Add your Python installation's `bin` (or `Scripts`) directory to your `PATH` — the python.org installers offer to do this for you, and on Ubuntu the `python-is-python3` package provides the short name.

This section briefly explains how to check what version of Python is present, and install a new one as needed, for Ubuntu Linux, macOS, and Windows.

> [!NOTE]
> Depending on your platform, you may also be able to install Python/pip from the operating system's own package manager or via other mechanisms. For most platforms, you can download the required installation files from <https://www.python.org/downloads/> and install them using the appropriate platform-specific method.

### Ubuntu 24.04

Ubuntu Linux 24.04 LTS includes Python 3.12 by default, which is new enough for Django 6.1.
However, the bare `python` command, the `pip` tool, and the module used to create virtual environments are **not** all available out of the box.
Install them in the bash terminal using:

```bash
sudo apt install python3-full python-is-python3
```

You can then confirm the version:

```bash
python -V
# Output: Python 3.12.3
```

> [!NOTE]
> The `python-is-python3` package is what makes the short `python` command available on Ubuntu, and `python3-full` bundles the `venv` module and `pip` that we use in the next sections.
> On Ubuntu, the system-wide Python installation is "externally managed", which means `pip` refuses to install packages into it.
> That is not a problem for us: we install everything into a virtual environment instead, which is the recommended practice anyway.

### macOS

macOS does not include a suitable Python by default.
You can check what you have by running the following command in the terminal:

```bash
python -V
```

This will either display the Python version number, or a "command not found" message, which indicates Python was not found.

You can install Python (along with the _pip_ tool) from [python.org](https://www.python.org/):

1. Download the required installer:
   1. Go to <https://www.python.org/downloads/macos/>
   2. Download the stable release of the most recent [supported version](https://docs.djangoproject.com/en/6.1/faq/install/#what-python-version-can-i-use-with-django) that works with Django 6.1.
      (at the time of writing this is Python 3.14).

2. Locate the file using _Finder_, and double-click the package file. Following the installation prompts.

You can now confirm successful installation by running `python -V` again and checking for the Python version number.

You can similarly check that _pip_ is installed by listing the available packages:

```bash
pip list
```

### Windows 10 or 11

Windows doesn't include Python by default, but you can easily install it (along with the _pip_ tool) from [python.org](https://www.python.org/):

1. Download the required installer:
   1. Go to <https://www.python.org/downloads/windows/>
   2. Download the stable release of the most recent [supported version](https://docs.djangoproject.com/en/6.1/faq/install/#what-python-version-can-i-use-with-django) that works with Django 6.1.
      (at the time of writing this is Python 3.14).

2. Install Python by double-clicking on the downloaded file and following the installation prompts
3. Be sure to check the box labeled "Add Python to PATH"

You can then verify that Python was installed by entering the following text into the command prompt:

```bash
python -V
```

The Windows installer incorporates _pip_ (the Python package manager) by default.
You can list installed packages as shown:

```bash
pip list
```

> [!NOTE]
> The installer should set up everything you need for the above commands to work.
> If however you get a message that Python cannot be found, you may have forgotten to add it to your system path.
> You can do this by running the installer again, selecting "Modify", and checking the box labeled "Add Python to environment variables" on the second page.

## Source code management with Git and GitHub

Source Code Management (SCM) and versioning tools allow you to reliably store and recover versions of your source code, try out changes, and share code between your experiments and "known good code" when you need to.

There are many different SCM tools, including git, Mercurial, Perforce, SVN (Subversion), CVS (Concurrent Versions System), etc., and cloud SCM hosting sources such as Bitbucket, GitHub, and GitLab.
For this tutorial we'll hosting our code on [GitHub](https://github.com/), one of the most popular cloud based source code hosting services, and using the **git** tool to manage our source code locally and send it to GitHub when needed.

> [!NOTE]
> Using SCM tools is good software development practice!
> These instructions provide a basic introduction to git and GitHub.
> To learn more, see [Learning Git](https://docs.github.com/en/get-started/start-your-journey/git-and-github-learning-resources).

### Key concepts

Git (and GitHub) use repositories ("repos") as the top level "bucket" for storing code, where each repo normally contains the source code for just one application or module.
Repositories can be public, in which case the code is visible to everyone on the internet, or private, in which case they are restricted to the owning organization or user account.

All work is done on a particular "branch" of code in your repo.
When you want to backup some changes to a branch you can create a "commit", which stores all changes since your last commit to the current branch.

The repo is created with a default branch named "main". You can spawn other branches off this using git, which initially have all the commits of the original branch.
You can evolve branches separately by adding commits, and then later on use a "Pull Request" (PR) on GitHub to merge changes from one branch to another.
You can also use git to switch between branches on your local computer, for example to try out different things.

In addition to branches, it is possible to create `tags` on any branch and later recover that branch at that point.

### Create an account and repository on GitHub

First we will create an account on GitHub (this is free).
Then we create and configure a repository named "django_local_library" for storing the [Local library website](/en-US/docs/Learn_web_development/Extensions/Server-side/Django/Tutorial_local_library_website) as we evolve it in the rest of this tutorial.

The steps are:

1. Visit <https://github.com/> and create an account.
2. Once you are logged in, click the **+** link in the top toolbar and select **New repository**.
3. Fill in all the fields on this form.
   While these are not compulsory, they are strongly recommended.
   - Enter a repository name: "django_local_library".
   - Enter a new repository description: "Local Library website written in Django".
   - Select "Public" for the repository (the default).

     > [!WARNING]
     > This will make _all_ source code visible.
     > Remember not to store credentials or other sensitive material in your repo unless it is private.

   - Choose **Python** in the _Add .gitignore_ selection list.
   - Choose your preferred license in the _Add license_ selection list.
     MDN uses "Creative Commons Zero v1.0 Universal" for this example.
   - Check **Initialize this repository with a README**.

4. Press **Create repository**.

   The repository will be created, containing just the files `README.txt` and `.gitignore`.

### Clone the repo to your local computer

Now that the repository ("repo") is created on GitHub we are going to want to clone (copy) it to our local computer:

1. On GitHub, click the green **Code** button.
   In the "Clone" section, select the "HTTPS" tab, and copy the URL.
   If you used the repository name "django_local_library", the URL should be something like: `https://github.com/<your_git_user_id>/django_local_library.git`.

2. Install _git_ for your local computer ([official Git download guide](https://git-scm.com/downloads/)).
3. Open a command prompt/terminal and clone your repo using the URL you copied above:

   ```bash
   git clone https://github.com/<your_git_user_id>/django_local_library.git
   ```

   This will create the repository inside the current directory.

4. Navigate into the repo folder.

   ```bash
   cd django_local_library
   ```

### Modify and sync changes

Now we're going to modify the `.gitignore` file on the local computer, commit the change, and update the repository on GitHub.
This is a useful change to make, but mostly we're doing it to show you how to pull changes from GitHub, make changes locally, and then push them to GitHub.

1. In the command prompt/terminal we first "fetch" (get) and then pull (get and merge into the current branch) the latest version of the source from GitHub:

   > [!NOTE]
   > This step isn't strictly necessary as we have just cloned the source and know it is up to date.
   > However in general you should update your sources from GitHub before making changes.

   ```bash
   git fetch origin main
   git pull origin main
   ```

   The "origin" is a _remote_, which represents the location of the repo where the source is located, and "main" is the branch.
   You can verify that origin is our repo on GitHub using the command: `git remote -v`.

2. Next we checkout a new branch to store our changes:

   ```bash
   git checkout -b update_gitignore
   ```

   The `checkout` command is used to switch some branch to be the current branch that you are working on.
   The `-b` flag indicates that we intend to create a new branch named "update_gitignore" instead of selecting an existing branch with that name.

3. Open the **.gitignore** file, copy the following lines into the bottom of it, and then save:

   ```plain
   # Text backup files
   *.bak

   # Database
   *.sqlite3

   # Python virtual environment
   .venv/
   ```

   Note that `.gitignore` is used to indicate files that should not be backed up by git automatically, such as temporary files and other build artifacts.

4. Use the `add` command to add all changed files (that aren't ignored by the **.gitignore** file) to the "staging area" for the current branch.

   ```bash
   git add -A
   ```

5. Use the `status` command to check that all files you are about to `commit` are correct (you want to include source files, not binaries, temporary files etc.).
   It should look a bit like the listing below.

   ```bash
   git status
   ```

   ```plain
   On branch update_gitignore
   Changes to be committed:
     (use "git restore --staged <file>..." to unstage)

           modified:   .gitignore
   ```

6. When you're satisfied, `commit` the files to your local repo, using the `-m` flag to specify a concise but clear commit message.
   This is equivalent to signing off on the changes and making them an official part of the local repo.

   ```bash
   git commit -m ".gitignore: ignore backups, database, and .venv"
   ```

7. At this point, the remote repo has not been changed.
   We can push the `update_gitignore` branch to the "origin" repo (GitHub) using the following command:

   ```bash
   git push origin update_gitignore
   ```

8. Go back to the page on GitHub where you created your repo and refresh the page.

   A banner should appear with a button to press if you want to "Compare and pull request" the branch you just uploaded.
   Select the button and then follow the instructions to create and then merge a pull request.

   ![Banner asking if user wants to compare and merge recent branch updates](github_compare_and_pull_banner.png)

   After merging, the "main" branch on the repo on GitHub will contain your changes to `.gitignore`.

9. You can continue to update your local repo as files change using this add/commit/push cycle.

This repo is the project folder for the rest of the module: the virtual environment we create next lives inside it, and it is where the local library website source code will be stored.

## Using Django inside a Python virtual environment

Now that you have a project folder — the **django_local_library** repo you cloned in the previous section — you can create the Python virtual environment that the rest of this module runs inside.

Throughout this module, and for every Django project you create afterwards, the rule is the same: **the virtual environment lives in a folder named `.venv` at the root of the project it belongs to**.
Keeping it beside the code, under a predictable name, means that:

- Every project gets its own independent set of packages, so a site pinned to an older Django keeps working after you install a newer Django for something else.
- Editors such as VS Code and PyCharm detect and select the environment automatically, so debugging and autocompletion work without extra configuration.
- There is nothing to remember: activating the environment is always the same command, run from the project root.
- Discarding the environment is just deleting the **.venv** folder, and recreating it is a single command.

The `venv` module used to create the environment is part of the Python standard library, so there is nothing extra to install first.

### Creating a virtual environment

Open a command shell (or terminal window), navigate to the root of your project, and create the environment:

```bash
cd django_local_library
python -m venv .venv
```

This creates a **.venv** folder inside **django_local_library** that contains a private copy of the interpreter along with its own package directory.
The command prints nothing when it succeeds.

> [!NOTE]
> The **.venv** folder must never be committed to git: it contains thousands of installed files, and it is not portable between machines or operating systems.
> This is why we added `.venv/` to **.gitignore** in the previous section.
> The **requirements.txt** file created below is what actually records your dependencies for other people (and for your production server).

### Using a virtual environment

The environment has to be _activated_ before it does anything.
Activation is the one command in this module whose form differs between operating systems — run it from the project root:

```bash
# Linux/macOS
source .venv/bin/activate

# Windows (Command Prompt)
.venv\Scripts\activate.bat

# Windows (PowerShell)
.venv\Scripts\Activate.ps1
```

You can tell that it worked because your prompt is now prefixed with the name of the environment folder:

```plain
(.venv) ubuntu@ubuntu:~/django_local_library$
```

From this point on `python` and `pip` refer to the environment's own copies on every platform, and anything you install with `pip` goes into **.venv** rather than into your system-wide Python.

> [!NOTE]
> If PowerShell refuses to run the activation script with a message about the execution policy, allow locally created scripts for the current user by running `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` and then try again.

There are just a few other commands you should know:

- `deactivate` — exit the current virtual environment (your prompt loses the `(.venv)` prefix).
- `source .venv/bin/activate` (or the Windows equivalent above) — re-enter it. You need to do this in every new terminal you open.
- Deleting the **.venv** folder — remove the environment completely. To rebuild it, run `python -m venv .venv` again, activate it, and reinstall the dependencies with `pip install -r requirements.txt`.

> [!NOTE]
> From now on in this article (and indeed in this module) please assume that every command is run from the project root with the virtual environment activated.

## Installing Django

With the environment activated, install Django from PyPI using `pip`:

```bash
pip install django~=6.1
```

The `~=6.1` specifier installs the newest 6.1.x release and accepts future 6.1 patch releases, but not Django 6.2 or later.
Pinning the version like this is what stops an unrelated upgrade from breaking your project halfway through the tutorial.

You can test that Django is installed by running the following command, which just checks that Python can find the Django module:

```bash
python -m django --version
```

It should report a version starting with `6.1`.

Finally, record the dependency so that the environment can be recreated from the repository:

```bash
pip freeze > requirements.txt
```

We will add more packages to this file in the [deployment](/en-US/docs/Learn_web_development/Extensions/Server-side/Django/Deployment) article, regenerating it the same way each time.
Commit **requirements.txt** to git along with the rest of your source.

## Other Python tools

Experienced Python developers may install additional tools, such as linters (which help detect common errors in code).

Note that you should use a Django-aware linter such as [pylint-django](https://pypi.org/project/pylint-django/), because some common Python linters (such as `pylint`) incorrectly report errors in the standard files generated for Django.

## Testing your installation

The version check above works, but it isn't very much fun. A more interesting test is to create a skeleton project and see it working.

With the virtual environment activated, create a new skeleton site called "_mytestsite_" using the `startproject` command as shown.
After creating the site you can navigate into the folder, where you will find the main script for managing projects, called **manage.py**.

```bash
python -m django startproject mytestsite
cd mytestsite
```

We can run the _development web server_ from within this folder using **manage.py** and the `runserver` command, as shown.

```bash
python manage.py runserver
```

> [!NOTE]
> You can ignore the warnings about "unapplied migration(s)" at this point!

Once the server is running you can view the site by navigating to the following URL on your local web browser: `http://127.0.0.1:8000/`. You should see a site that looks like this:

![The home page of the skeleton Django app](django_skeleton_app_homepage_django_4_0.png)

Stop the server with <kbd>Ctrl</kbd> + <kbd>C</kbd> when you're done.

This was only a scratch project, so return to the project root and delete the **mytestsite** folder before you commit anything — the real site is created in the next article.

```bash
cd ..
rm -r mytestsite
```

## Summary

You now have a Django development environment up and running on your computer.

In the testing section you also briefly saw how we can create a new Django website using `python -m django startproject`, and run it in your browser using the development web server (`python manage.py runserver`). In the next article, we expand on this process, building a simple but complete web application.

## See also

- [Quick Install Guide](https://docs.djangoproject.com/en/6.1/intro/install/) (Django docs)
- [How to install Django — Complete guide](https://docs.djangoproject.com/en/6.1/topics/install/) (Django docs) — also covers how to remove Django
- [How to install Django on Windows](https://docs.djangoproject.com/en/6.1/howto/windows/) (Django docs)
- [venv — Creation of virtual environments](https://docs.python.org/3/library/venv.html) (Python docs)
- [Installing packages using pip and virtual environments](https://packaging.python.org/en/latest/guides/installing-using-pip-and-virtual-environments/) (Python Packaging User Guide)

{{PreviousMenuNext("Learn_web_development/Extensions/Server-side/Django/Introduction", "Learn_web_development/Extensions/Server-side/Django/Tutorial_local_library_website", "Learn_web_development/Extensions/Server-side/Django")}}
