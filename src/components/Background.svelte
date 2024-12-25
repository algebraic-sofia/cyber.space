<script lang="ts">
	import { addResource, emptyManager, loadAllResources } from "$lib/loader";
	import { createContext, engineRender } from '$lib/engine';
	import { onMount } from 'svelte';

	let canvas: HTMLCanvasElement;
	let innerWidth: number = 0;
	let innerHeight: number = 0;

	onMount(async () => {
		let manager = emptyManager();

		addResource(manager, "utf-8", "frag", "http://localhost:5173/shaders/frag.wgsl")
		addResource(manager, "utf-8", "vert", "http://localhost:5173/shaders/vert.wgsl")

		// Loads all resources
		await loadAllResources(manager, (p, r, _) => {console.log(r.name, p)})

		const context = await createContext(canvas, manager);

		const render = () => {
			if (!canvas) {
				return;
			}

			if (innerWidth != canvas.width || innerHeight != canvas.height) {
				canvas.width = innerWidth;
				canvas.height = innerHeight;
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
