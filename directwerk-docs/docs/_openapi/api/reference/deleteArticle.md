---
title: "Delete an article"
description: "Deletes an article in any status. The hero asset is detached, never deleted (S3 objects survive); category assignments are removed with the article. Custom article feeds select by category at read time and never reference article ids, so no feed rules need cleanup — feeds simply stop including the article. Returns 204 with an empty body."
layout: doc
aside: false
editLink: false
prev: false
next: false
---

<OpenApiEndpoint id="directwerk.deleteArticle" />
