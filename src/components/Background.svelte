<script lang="ts">
	import { createContext, engineRender } from '$lib/engine';
	import { onMount } from 'svelte';

	let canvas: HTMLCanvasElement;
	let innerWidth: number = 0;
	let innerHeight: number = 0;

	onMount(async () => {
		const context = createContext(canvas);

		const render = () => {
			if (innerWidth != context.canvas.width || innerHeight != context.canvas.height) {
				context.canvas.width = innerWidth;
				context.canvas.height = innerHeight;
			}

			engineRender(context, 2);
			requestAnimationFrame(render);
		};

		render();
	});
</script>

<svelte:window bind:innerWidth bind:innerHeight />

<canvas bind:this={canvas} width={innerWidth} height={innerHeight}></canvas>

<style>
	canvas {
		position: fixed;
		top: 0;
		left: 0;
		z-index: -1;
	}
</style>
