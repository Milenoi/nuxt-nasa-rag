<script setup lang="ts">
// A small "i" badge that reveals a short hint. Built on the shadcn-vue Popover
// (reka-ui), NOT Tooltip: tooltips are a hover/focus pattern by design and never
// open on touch, whereas a popover opens on click/tap, so it works on mobile too.
import { Info } from '@lucide/vue'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

defineProps<{ text?: string }>()
</script>

<template>
  <Popover>
    <PopoverTrigger
      :aria-label="text"
      class="inline-flex size-5 items-center justify-center rounded-full align-middle text-text-faint transition-colors hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/50"
    >
      <Info class="size-3.5" />
    </PopoverTrigger>
    <PopoverContent class="w-auto max-w-56 text-sm leading-relaxed">
      {{ text }}
    </PopoverContent>
  </Popover>
</template>
