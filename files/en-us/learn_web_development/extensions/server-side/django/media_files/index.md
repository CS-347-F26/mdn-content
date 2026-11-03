---
title: "Django Tutorial Part 9.5: Media files and user uploads"
short-title: "9.5: Media files"
slug: Learn_web_development/Extensions/Server-side/Django/Media_files
page-type: learn-module-chapter
sidebar: learnsidebar
---

{{PreviousMenuNext("Learn_web_development/Extensions/Server-side/Django/Forms", "Learn_web_development/Extensions/Server-side/Django/Testing", "Learn_web_development/Extensions/Server-side/Django")}}

In this tutorial, we'll show you how Django stores and serves _media files_: files that are uploaded to your site while it is running, rather than written by you as part of the code.
As part of this demonstration, we'll extend the [LocalLibrary](/en-US/docs/Learn_web_development/Extensions/Server-side/Django/Tutorial_local_library_website) website so that librarians can upload a cover image for a book and a photo of an author, and display these images on the book and author detail pages.

<table>
  <tbody>
    <tr>
      <th scope="row">Prerequisites:</th>
      <td>
        Complete all previous tutorial topics, including
        <a href="/en-US/docs/Learn_web_development/Extensions/Server-side/Django/Forms">Django Tutorial Part 9: Working with forms</a>.
      </td>
    </tr>
    <tr>
      <th scope="row">Objective:</th>
      <td>
        To understand the difference between static files and media files.
        To understand how to store uploaded files with <code>FileField</code> and <code>ImageField</code>, accept them in forms, and display them in templates.
        To understand why uploaded files need special care, both for security and in production.
      </td>
    </tr>
  </tbody>
</table>

## Overview

So far, every file that our site sends to the browser, other than the HTML generated from our templates, has been a _static file_: the CSS, JavaScript and images that we wrote (or downloaded) while developing the site.
Static files are part of the code.
They are checked into git, they are the same on every computer the site runs on, and when we deploy the site, Django's `collectstatic` command gathers them into `STATIC_ROOT` so that they can be served efficiently.

_Media files_ are different.
They are files that _users_ add to the site while it is running, such as profile pictures, documents attached to a record, or, in our case, book covers and author photos.
This means that:

- Media files don't exist when you write the code, so they can't be checked into git or gathered by `collectstatic`.
- Each copy of the site (your development computer, the production server) has its own, different set of media files.
- Media files are created by users, so they can't be trusted. A user could upload a huge file, a file that isn't really an image, or a file named to overwrite something important.

Django keeps media files apart from static files, with their own settings, so that you can store and serve them differently:

- `MEDIA_ROOT`: The folder where Django saves uploaded files.
- `MEDIA_URL`: The base URL from which those files are served (the media equivalent of `STATIC_URL`).

A model doesn't store an uploaded file in the database.
Instead, a [`FileField`](https://docs.djangoproject.com/en/6.1/ref/models/fields/#filefield) (or its image-specific subclass, [`ImageField`](https://docs.djangoproject.com/en/6.1/ref/models/fields/#imagefield)) saves the file under `MEDIA_ROOT`, and stores only the file's _path_, relative to `MEDIA_ROOT`, in the database.
In templates, the field gives you the URL of the file, built from `MEDIA_URL`.

In the rest of this tutorial, we'll add a `cover_image` field to the `Book` model and a `photo` field to the `Author` model, and then update the site so that staff can upload these images and everyone can see them.

## Installing Pillow

`ImageField` uses the [Pillow](https://pypi.org/project/pillow/) imaging library to check that each uploaded file really is an image.
Django doesn't install Pillow for you, and if it is missing you'll get an error like `fields.E210: Cannot use ImageField because Pillow is not installed` when you try to create migrations.

Install Pillow in your project with `uv`:

```bash
uv add pillow
```

> [!NOTE]
> If you only need to accept arbitrary files (for example, PDF documents), use `FileField` instead.
> It doesn't need Pillow, but it also doesn't check what kind of file was uploaded.

## Configuring media settings

Open **locallibrary/locallibrary_config/settings.py** and add the `MEDIA_URL` and `MEDIA_ROOT` settings below the `STATIC_URL` and `STATIC_ROOT` settings you added in [Django Tutorial Part 2: Creating a skeleton website](/en-US/docs/Learn_web_development/Extensions/Server-side/Django/skeleton_website#hooking_up_the_url_mapper):

```python
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

# Files uploaded by users (for example, book covers and author photos)
MEDIA_URL = 'media/'
MEDIA_ROOT = BASE_DIR / 'media'
```

With these settings, an uploaded file is saved in the **media** folder next to **manage.py**, and is available at a URL starting with `/media/`.

`MEDIA_ROOT` must be a different folder from `STATIC_ROOT`, and `MEDIA_URL` must be different from `STATIC_URL` (Django reports an error if they are the same).
Keeping them apart means that `collectstatic` never mixes your code's files with users' files.

The **media** folder holds data, not code, so it doesn't belong in git (just like your **db.sqlite3** database).
Add this line to the end of your repository's **.gitignore**:

```plain
media/
```

### Serving media files during development

Just like static files, Django doesn't serve media files by default.
During development, you can ask the development server to serve them by using the same `static()` helper you used for static files.

Open **locallibrary/locallibrary_config/urls.py** and add the following line to the bottom of the file, after the line that serves static files:

```python
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
```

The `settings` and `static` imports were added in Part 2, so you don't need to import them again.

> [!NOTE]
> `static()` only adds URL patterns when `DEBUG` is `True`.
> When `DEBUG` is `False` it does nothing, so this line is safe to leave in place, but it won't serve your media files in production.
> We describe what to do in production in [Media files in production](#media_files_in_production), below.

## Models

Open **locallibrary/catalog/models.py** and add a `cover_image` field to the `Book` model:

```python
class Book(models.Model):
    """Model representing a book (but not a specific copy of a book)."""
    title = models.CharField(max_length=200)
    # …
    cover_image = models.ImageField(
        upload_to='book_covers/', blank=True,
        help_text="An image of the book's cover")
    # …
```

Then add a `photo` field to the `Author` model:

```python
class Author(models.Model):
    """Model representing an author."""
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    date_of_birth = models.DateField(null=True, blank=True)
    date_of_death = models.DateField('Died', null=True, blank=True)
    photo = models.ImageField(upload_to='author_photos/', blank=True)
    # …
```

The `upload_to` argument sets the folder, relative to `MEDIA_ROOT`, in which the uploaded files are saved.
So a cover image uploaded as **dune.jpg** is saved as **media/book_covers/dune.jpg**, and the database stores the string `book_covers/dune.jpg`.
Keeping each kind of upload in its own folder makes the files easier to manage (and lets you back up or clean up each kind separately).

If a file with the same name already exists, Django doesn't overwrite it.
Instead, it adds some random characters to the new file's name (for example, **dune_a1B2c3D.jpg**).

We set `blank=True` because existing books and authors don't have images, and an image is optional for new records too.
A `FileField` or `ImageField` stores an empty string when there is no file, so, as for a `CharField`, you don't need `null=True`.

Now run the migrations to add the new columns to the database:

```bash
uv run python manage.py makemigrations
uv run python manage.py migrate
```

### Admin site

You don't need to change the admin site at all.
Because the admin uses `ModelForm`s generated from your models, the book and author edit pages now have a file input for the new fields.
Try uploading a cover image for one of your books in the admin site, and then look in your **media/book_covers** folder: you should see the file there.

## Uploading files with forms

Uploading a file in a form needs two things that we haven't used before: one in the HTML form, and one in the view.

### The form's encoding type

By default, a browser sends the data in a form using the `application/x-www-form-urlencoded` encoding, which can only include text.
For a file input, it sends just the file's _name_, and not its contents.

To send the contents of files, the `<form>` element must set its [`enctype`](/en-US/docs/Web/HTML/Reference/Elements/form#enctype) attribute to `multipart/form-data` (and use the `POST` method):

```html
<form action="" method="post" enctype="multipart/form-data">
  <!-- form fields -->
</form>
```

> [!WARNING]
> Forgetting `enctype="multipart/form-data"` is the most common mistake when uploading files.
> Django doesn't report any error: the form submits successfully, but the file is never received.
> For an optional field like ours, this means the record is silently saved without an image.

You can check whether a form needs this encoding in the template with `\{{ form.is_multipart }}`, which is `True` if any of the form's fields is a file field.

### Uploaded files in the view

Django puts the text fields of a submitted form in `request.POST`, but it puts uploaded files in a separate dictionary-like object, `request.FILES`.
A form that includes file fields must be given _both_ when it is bound in a view, as shown below:

```python
form = MyForm(request.POST, request.FILES)
```

This is only something you need to remember if you write a function view like the one for [renewing books](/en-US/docs/Learn_web_development/Extensions/Server-side/Django/Forms#view).
The generic editing views (`CreateView`, `UpdateView` and `FormView`) already pass `request.FILES` to their forms, so the views below don't need any extra code.

When the form is valid and the model is saved, Django checks that the file is a valid image, saves it under `MEDIA_ROOT`, and stores its path in the model field.

## Example — author photos

In [Django Tutorial Part 9: Working with forms](/en-US/docs/Learn_web_development/Extensions/Server-side/Django/Forms#generic_editing_views) we created `AuthorCreate` and `AuthorUpdate` views.
Let's update them so that staff can upload a photo of the author.

### Views

Open **locallibrary/catalog/views.py** and add `photo` to the `fields` of the `AuthorCreate` view:

```python
class AuthorCreate(PermissionRequiredMixin, CreateView):
    model = Author
    fields = ['first_name', 'last_name', 'date_of_birth', 'date_of_death', 'photo']
    initial = {'date_of_death': '11/11/2023'}
    permission_required = 'catalog.add_author'
```

You don't need to change `AuthorUpdate`, because it uses `fields = '__all__'`, so it already includes the new `photo` field.
This is exactly the behavior we warned about in the forms tutorial: a new model field was added to a form without anyone deciding that it should be.
Here it's what we want, but it would be safer to list the fields explicitly.

### Template

Both views use the **author_form.html** template.
Open **locallibrary/catalog/templates/catalog/author_form.html** and add `enctype="multipart/form-data"` to the `<form>` element:

```django
{% extends "base_generic.html" %}

{% block content %}
<form action="" method="post" enctype="multipart/form-data">
  {% csrf_token %}
  <table>
    \{{ form.as_table }}
  </table>
  <input type="submit" value="Submit">
</form>
{% endblock %}
```

The `photo` field is displayed using Django's `ClearableFileInput` widget.
On the "create" page this is just a file input.
On the "update" page, if the author already has a photo, the widget also shows a link to the current file and (because the field is optional) a **Clear** checkbox that removes the photo from the record.
If the user doesn't choose a new file, the current photo is kept.

### Displaying the photo

To display an uploaded file, use the `url` attribute of the field, which combines `MEDIA_URL` with the path stored in the database (for example, `/media/author_photos/herbert.jpg`).

Open **locallibrary/catalog/templates/catalog/author_detail.html** (which you created in the [generic views challenge](/en-US/docs/Learn_web_development/Extensions/Server-side/Django/Generic_views#challenge_yourself)) and add the following code to the top of the `content` block:

```django
{% if author.photo %}
  <img src="\{{ author.photo.url }}" alt="Photo of \{{ author }}" class="img-thumbnail float-end" width="200">
{% endif %}
```

The `{% if %}` check is important.
If an author has no photo, then `author.photo.url` raises a `ValueError`, because there is no file to build a URL for.
In a template, this error is reported rather than silently ignored, so the whole page fails to display.

The `img-thumbnail` and `float-end` classes are [Bootstrap](https://getbootstrap.com/) classes (our base template already includes Bootstrap) that give the image a border and move it to the right of the author's details.

## Example — book cover images

We don't have a page for editing books yet (unless you completed the [forms challenge](/en-US/docs/Learn_web_development/Extensions/Server-side/Django/Forms#challenge_yourself)), so instead we'll create a small page that does just one thing: upload a book's cover image.
This is also a useful pattern in its own right: a separate page for a file upload keeps the main edit form simple, and you can give it its own permission if you want.

### View

Open **locallibrary/catalog/views.py** and add the following view to the bottom of the file:

```python
class BookCoverUpdate(PermissionRequiredMixin, UpdateView):
    """Upload or change the cover image of a book."""
    model = Book
    fields = ['cover_image']
    template_name_suffix = '_cover_form'
    permission_required = 'catalog.change_book'
```

This is an ordinary `UpdateView` for `Book`, but the form only includes the `cover_image` field.
We set `template_name_suffix` so that the view uses a template named **book_cover_form.html**, rather than the default **book_form.html** (which you might already be using for the book create and update pages).
As with the author views, after a successful upload the view redirects to the book's detail page (from `get_absolute_url()`).

### URL configuration

Open **locallibrary/catalog/urls.py** and add the following configuration to the bottom of the file:

```python
urlpatterns += [
    path('book/<int:pk>/cover/', views.BookCoverUpdate.as_view(), name='book-cover'),
]
```

### Templates

Create the template file **locallibrary/catalog/templates/catalog/book_cover_form.html** and copy the text below:

```django
{% extends "base_generic.html" %}

{% block content %}
  <h1>Cover image: \{{ book.title }}</h1>

  {% if book.cover_image %}
    <p>
      <img src="\{{ book.cover_image.url }}" alt="Current cover of \{{ book.title }}" class="img-thumbnail" width="200">
    </p>
  {% endif %}

  <form action="" method="post" enctype="multipart/form-data">
    {% csrf_token %}
    <table>
      \{{ form.as_table }}
    </table>
    <input type="submit" value="Upload">
  </form>
{% endblock %}
```

Then open **locallibrary/catalog/templates/catalog/book_detail.html** and add the following code just below the `<h1>` heading, to display the cover image:

```django
{% if book.cover_image %}
  <img src="\{{ book.cover_image.url }}" alt="Cover of \{{ book.title }}" class="img-thumbnail float-end" width="200">
{% endif %}
```

Finally, add a link to the new page in the sidebar of the book detail page, for users who can change books.
Add the following code to the end of **book_detail.html**:

```django
{% block sidebar %}
  \{{ block.super }}

  {% if perms.catalog.change_book %}
  <hr>
  <ul class="sidebar-nav">
    <li><a href="{% url 'book-cover' book.id %}">Change cover image</a></li>
  </ul>
  {% endif %}
{% endblock %}
```

> [!NOTE]
> If you completed the forms challenge, **book_detail.html** may already have a `sidebar` block with links to update and delete the book.
> In that case, just add the "Change cover image" `<li>` to the list inside it, rather than adding a second `sidebar` block (a template can't define the same block twice).

### Testing the pages

First, log in to the site with an account that has the `catalog.change_book`, `catalog.add_author`, and `catalog.change_author` permissions (you can add these to your "Librarians" group in the admin site). Don't use your superuser, because permission checks always pass for superusers.

1. Open the detail page for one of your books and select **Change cover image** in the sidebar (the URL is something like `http://127.0.0.1:8000/catalog/book/3/cover/`).
2. Choose an image file and select **Upload**. You should be taken back to the book detail page, which now shows the cover.
3. Look in your project's **media/book_covers** folder: the image you uploaded is there.
4. Try uploading a file that isn't an image (for example, a text file renamed to **cover.jpg**). The form should be displayed again, with an error like "Upload a valid image. The file you uploaded was either not an image or a corrupted image."
5. Now select **Create author** in the sidebar, fill in the form, and choose a photo. After you submit the form, the author detail page should show the photo.
6. Select **Update author**, check the **Clear** checkbox, and submit the form. The photo is no longer shown on the author detail page.

After step 6, look in the **media/author_photos** folder.
The photo file is still there!
Django removes the file from the _record_, but it never deletes files from storage, either when a file is cleared or replaced, or when the record is deleted.
This is deliberate: Django can't be sure that nothing else is using the file (for example, if a database transaction is rolled back after the file was deleted, the record would refer to a missing file).
If you need to clean up unused files, you can write code to do it (see the [challenge](#challenge_yourself) below), or use a package such as [django-cleanup](https://pypi.org/project/django-cleanup/).

## Uploaded files and security

Every uploaded file comes from a user, so you should treat it as untrusted, just like any other user input.
Django helps in several ways:

- It strips any folder names from the uploaded file's name, so a user can't save a file outside your `upload_to` folder (for example, by naming it `../../locallibrary_config/settings.py`).
- It never overwrites an existing file, as we saw above.
- An `ImageField` only accepts files with image extensions (such as **.jpg**, **.png** and **.gif**), and uses Pillow to check that the contents really are an image.

However, there are things that Django leaves for you to decide.

### Limiting file size

Django doesn't limit the size of uploaded files.
It streams large uploads to a temporary file instead of holding them in memory, but a user could still fill up your server's disk.
(The [`DATA_UPLOAD_MAX_MEMORY_SIZE`](https://docs.djangoproject.com/en/6.1/ref/settings/#data-upload-max-memory-size) setting limits the size of the _rest_ of the request, but it doesn't include uploaded files.)

You can add a limit with a [validator](https://docs.djangoproject.com/en/6.1/ref/validators/): a function that raises a `ValidationError` if a value isn't allowed.
Add the following function to **locallibrary/catalog/models.py**, above the model classes:

```python
from django.core.exceptions import ValidationError

def validate_image_size(image):
    """Reject images larger than 2 MB."""
    max_size = 2 * 1024 * 1024
    if image.size > max_size:
        raise ValidationError('Image files must be smaller than 2 MB.')
```

Then add it to the `validators` of both image fields, for example:

```python
cover_image = models.ImageField(
    upload_to='book_covers/', blank=True,
    validators=[validate_image_size],
    help_text="An image of the book's cover")
```

Run `makemigrations` and `migrate` again (Django records validators in migrations, even though they don't change the database).
A `ModelForm` runs the model's validators when it is validated, so both the admin site and our own forms will now show an error for an image that is too large.

> [!NOTE]
> A validator only runs after the whole file has been uploaded.
> To stop very large requests before they reach Django at all, production web servers usually also have a limit on the size of the request body (for example, `client_max_body_size` in nginx).

### File names and serving files

By default, the uploaded file keeps the name the user gave it.
This name might reveal information the user didn't mean to share, and it makes it easy to guess the URLs of other files.
If this matters for your site, you can pass a function as `upload_to` that chooses the name instead:

```python
import pathlib
import uuid

def book_cover_path(instance, filename):
    """Save covers with a random name, keeping only the file extension."""
    extension = pathlib.Path(filename).suffix.lower()
    return f'book_covers/{uuid.uuid4()}{extension}'
```

and declare the field with `upload_to=book_cover_path`.

Finally, remember that anyone who knows a media file's URL can download it: Django's permission checks protect our _views_, but media files are served directly, without running any view code.
That is fine for book covers, but you should never use `MEDIA_ROOT` for private files (for those, you would need a view that checks permissions and then sends the file).
Django's [user-uploaded content](https://docs.djangoproject.com/en/6.1/topics/security/#user-uploaded-content-security) security guide describes some further precautions, such as serving media files from a different domain.

## Media files in production

When you deploy the site in [Django Tutorial Part 11: Deploying Django to production](/en-US/docs/Learn_web_development/Extensions/Server-side/Django/Deployment), you'll need to think about media files separately from static files:

- With `DEBUG` set to `False`, the `static()` line in **urls.py** no longer serves anything.
- WhiteNoise, which we use to serve static files, doesn't serve media files.
  It is designed for files that exist when the site starts and don't change, which isn't true for uploads.
- The media files on your development computer aren't in git, so they won't be uploaded with your code.
  The production site starts with an empty media folder (and the records in your production database won't refer to your development files anyway).

So media files need somewhere to be stored that survives redeploys, and something other than Django to serve them.
In Part 11 we deploy the site with Docker Compose, and each deploy replaces the app's container with a new one, throwing away any files saved inside it.
We keep `MEDIA_ROOT` in a Docker _volume_ (which survives rebuilds, just like the database), and have the Caddy web server serve the files in that volume at `MEDIA_URL`.
See [Media files](/en-US/docs/Learn_web_development/Extensions/Server-side/Django/Deployment#media_files) in Part 11 for the details.

Another common approach, especially on hosts where you can't keep files on disk at all, is to store media files in an object storage service, such as Amazon S3 or another S3-compatible service.

Django supports other storage systems through the `"default"` entry of the [`STORAGES`](https://docs.djangoproject.com/en/6.1/ref/settings/#std-setting-STORAGES) setting.
The [django-storages](https://django-storages.readthedocs.io/en/latest/) package provides backends for many services; for example, after running `uv add "django-storages[s3]"`, you could configure S3 storage like this (if you set `STORAGES`, you must give both entries):

```python
STORAGES = {
    "default": {
        "BACKEND": "storages.backends.s3.S3Storage",
    },
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
    },
}
```

The bucket name and access keys are read from settings such as `AWS_STORAGE_BUCKET_NAME`, `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` (which, like your `SECRET_KEY`, should come from environment variables, not from your code).
Your models, views and templates don't change at all: `ImageField` saves files to whatever storage is configured, and `.url` returns the URL of the file in that storage.

## Challenge yourself

Here are a few ways you can extend what you've built:

- If you completed the [forms challenge](/en-US/docs/Learn_web_development/Extensions/Server-side/Django/Forms#challenge_yourself), add `cover_image` to the fields of your `BookCreate` and `BookUpdate` views, and add `enctype="multipart/form-data"` to **book_form.html**.
- Show a small version of each book's cover next to its title on the book list page (and each author's photo on the author list page). Remember to check that the image exists first!
- Delete the old file from storage when an author's photo is replaced or cleared, or when an author is deleted.
  _Hint:_ in your `AuthorUpdate` view's `form_valid()` method, compare the new value of `photo` with the value in the database _before_ saving, and call `delete(save=False)` on the old file if it changed.
  In `AuthorDelete`, delete the file after the record has been deleted successfully.

## Summary

Media files are files that users add to your site while it is running, and Django keeps them separate from your static files, in `MEDIA_ROOT`, at `MEDIA_URL`.
You've learned how to store uploaded images with an `ImageField`, accept uploads in forms (remembering `enctype="multipart/form-data"`!), and display them in templates with the field's `url` attribute.
You've also seen that uploaded files can't be trusted, and that they need a plan of their own when you deploy your site.

In the next article, we'll show you how to write automated tests for the LocalLibrary website.

## See also

- [Managing files](https://docs.djangoproject.com/en/6.1/topics/files/) (Django docs)
- [File uploads](https://docs.djangoproject.com/en/6.1/topics/http/file-uploads/) (Django docs)
- [`FileField`](https://docs.djangoproject.com/en/6.1/ref/models/fields/#filefield) and [`ImageField`](https://docs.djangoproject.com/en/6.1/ref/models/fields/#imagefield) (Django docs)
- [Serving files uploaded by a user during development](https://docs.djangoproject.com/en/6.1/howto/static-files/#serving-files-uploaded-by-a-user-during-development) (Django docs)
- [User-uploaded content](https://docs.djangoproject.com/en/6.1/topics/security/#user-uploaded-content-security) (Django security docs)
- [django-storages](https://django-storages.readthedocs.io/en/latest/) (package docs)

{{PreviousMenuNext("Learn_web_development/Extensions/Server-side/Django/Forms", "Learn_web_development/Extensions/Server-side/Django/Testing", "Learn_web_development/Extensions/Server-side/Django")}}
