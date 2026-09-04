---
title: "Delete an episode"
description: "Deletes an episode in any status. Media assets are detached, never deleted (S3 objects survive); format/category assignments are removed with the episode. Custom and subscriber feeds select by format/category at read time and never reference episode ids, so no feed rules need cleanup — feeds simply stop including the episode. Returns 204 with an empty body."
layout: doc
aside: false
editLink: false
prev: false
next: false
---

<OpenApiEndpoint id="directwerk.deleteEpisode" />
