<script lang="ts">
  import SliderSetting from '../SliderSetting.svelte'
  import ToggleSetting from '../ToggleSetting.svelte'
  import type { SobelPassSettings } from '../../cv/passes/structure/StructurePassSettings'

  export let settings: SobelPassSettings
  export let required: boolean = false

  let enabled = settings.enabled
  let thetaRadius = settings.thetaRadius
  let rhoRadius = settings.rhoRadius
  let magnitudeScale = settings.magnitudeScale
  let lengthScale = settings.lengthScale
  let diagonalWeakening = settings.diagonalWeaking

  $: if (settings) {
    enabled = settings.enabled
    thetaRadius = settings.thetaRadius
    rhoRadius = settings.rhoRadius
    magnitudeScale = settings.magnitudeScale
    lengthScale = settings.lengthScale
    diagonalWeakening = settings.diagonalWeaking
  }

  function setEnabled(value: boolean): void {
    enabled = value
    settings.enabled = value
  }

  function setThetaRadius(value: number): void {
    thetaRadius = value
    settings.thetaRadius = value
  }

  function setRhoRadius(value: number): void {
    rhoRadius = value
    settings.rhoRadius = value
  }

  function setMagnitudeScale(value: number): void {
    magnitudeScale = value
    settings.magnitudeScale = value
  }

  function setLengthScale(value: number): void {
    lengthScale = value
    settings.lengthScale = value
  }

  function setDiagonalWeakening(value: number): void {
    diagonalWeakening = value
    settings.diagonalWeaking = value
  }
</script>

<div class="settings">
  {#if !required}
    <ToggleSetting label="Enabled" checked={enabled} on:change={(e) => setEnabled(e.detail.checked)} />
  {/if}
  <SliderSetting
    label="Theta Radius"
    min={0}
    max={10}
    step={1}
    value={thetaRadius}
    on:input={(e) => setThetaRadius(e.detail.value)}
  />
  <SliderSetting
    label="Rho Radius"
    min={0}
    max={10}
    step={1}
    value={rhoRadius}
    on:input={(e) => setRhoRadius(e.detail.value)}
  />
  <SliderSetting
    label="Magnitude Scale"
    min={0}
    max={5}
    step={0.05}
    value={magnitudeScale}
    on:input={(e) => setMagnitudeScale(e.detail.value)}
  />
  <SliderSetting
    label="Length Scale"
    min={0}
    max={5}
    step={0.05}
    value={lengthScale}
    on:input={(e) => setLengthScale(e.detail.value)}
  />
  <SliderSetting
    label="Diagonal Weakening"
    min={0}
    max={1}
    step={0.005}
    value={diagonalWeakening}
    on:input={(e) => setDiagonalWeakening(e.detail.value)}
  />
</div>
