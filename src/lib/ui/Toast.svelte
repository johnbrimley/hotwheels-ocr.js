<script lang="ts">
  import { fly } from 'svelte/transition'

  export let message = ''
  export let open = false
  export let duration = 2000

  let timer: ReturnType<typeof setTimeout> | null = null

  $: if (open) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => (open = false), duration)
  }

  function close() {
    open = false
    if (timer) clearTimeout(timer)
  }
</script>

{#if open}
  <div class="toast" role="status" transition:fly={{ y: 10, duration: 150 }}>
    {message}
  </div>
{/if}

<style>
  .toast {
    position: fixed;
    bottom: 16px;
    right: 16px;
    padding: 10px 14px;
    border-radius: 12px;
    background: rgba(0, 0, 0, 0.8);
    color: #fff;
    border: 1px solid rgba(255, 255, 255, 0.14);
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35);
    font-size: 13px;
    cursor: pointer;
    z-index: 20;
  }
</style>
