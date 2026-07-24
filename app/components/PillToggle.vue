<script setup lang="ts">
// A small pill switch (role="switch") bound with v-model. The track stays neutral;
// the knob turns cyan with a soft glow when on. `labelShort`, when given, replaces
// `label` below the sm breakpoint so two toggles fit one line on phones.
defineProps<{ modelValue: boolean; label?: string; labelShort?: string }>()
defineEmits<{ 'update:modelValue': [boolean] }>()
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="modelValue"
    :aria-label="label"
    class="group inline-flex items-center gap-2.5 rounded-full text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/50 focus-visible:ring-offset-2 focus-visible:ring-offset-space-deep"
    :class="modelValue ? 'text-text-strong' : 'text-text-faint hover:text-text-secondary'"
    @click="$emit('update:modelValue', !modelValue)"
  >
    <span class="relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full border-2 border-white/10 bg-white/5 px-0.5 transition-colors duration-300 group-hover:border-white/20">
      <span
        class="size-5 rounded-full transition-all duration-300"
        :class="modelValue ? 'translate-x-5 bg-accent-cyan shadow-[0_0_12px_0_var(--accent-cyan)]' : 'translate-x-0 bg-text-faint'"
      />
    </span>
    <span class="whitespace-nowrap">
      <span :class="labelShort ? 'hidden sm:inline' : ''">{{ label }}</span>
      <span
        v-if="labelShort"
        class="sm:hidden"
      >{{ labelShort }}</span>
    </span>
  </button>
</template>
