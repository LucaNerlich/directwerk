---
title: "Delete multiple episodes"
description: "Deletes every id in a single transaction with at most one RSS refresh (only when a visible episode was deleted). Atomic: the first failure rolls back all deletes. Duplicate ids are deleted once. Accepts 1-100 ids."
layout: doc
aside: false
editLink: false
prev: false
next: false
---

<OpenApiEndpoint id="directwerk.bulkDelete" />
