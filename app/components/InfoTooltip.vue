<script setup lang="ts">
// A small "i" badge that reveals a short hint on hover or keyboard focus, so
// explanatory copy can stay out of the layout until it's wanted. Built on the
// shadcn-vue Tooltip (reka-ui) so it matches the rest of the UI primitives.
import { Info } from '@lucide/vue'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

defineProps<{ text?: string }>()
</script>

<template>
  <TooltipProvider :delay-duration="120">
    <Tooltip>
      <TooltipTrigger
        type="button"
        :aria-label="text"
        class="inline-flex size-5 items-center justify-center rounded-full align-middle text-text-faint transition-colors hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/50"
      >
        <Info class="size-3.5" />
      </TooltipTrigger>
      <TooltipContent class="max-w-56 leading-relaxed">
        {{ text }}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
</template>
