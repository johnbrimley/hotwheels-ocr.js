import init from './wasm/hotwheels-ocr-wasm.js'
import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'

// Initialize WASM module before starting the app. Must happen before svelte mounts.
await init();

const app = mount(App, {
  target: document.getElementById('app')!,
})

export default app
