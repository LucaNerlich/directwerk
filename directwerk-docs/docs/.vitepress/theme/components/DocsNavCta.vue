<template>
  <a
    class="docs-nav-cta"
    :class="{ 'is-screen-menu': screenMenu }"
    href="https://directwerk.org/#contact"
    target="_blank"
    rel="noopener noreferrer"
  >
    Get access
  </a>
</template>

<script setup lang="ts">
defineProps<{
  screenMenu?: boolean
}>()
</script>
