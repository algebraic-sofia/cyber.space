/**
 * @module: Loader
 * @description: Loads all the resources needed to run the website.
 */

/**
 * Represents the type of the encoded thing, It's useful to decode it.
 */
type ResourceType =
	| "utf-8"
	| "other"

/**
 * Represents a single resource to be loaded.
 */
export type Resource = {
	type: ResourceType;
	name: string;
	url: string;
	loaded: boolean;
	data?: ArrayBuffer | string;
};

/**
 * Represents the loading progress of resources.
 */
export type Progress = {
	loadedCount: number;
	totalCount: number;
};

/**
 * Manages the state of all resources being loaded.
 */
export type Manager = {
	resources: Map<string, Resource>;
	loadedCount: number;
	totalCount: number;
};

/**
 * An empty manager with no resources loaded or tracked.
 */
export const emptyManager = () => ({
	resources: new Map(),
	loadedCount: 0,
	totalCount: 0,
});

/**
 * Fetches a resource from the specified URL and loads its data.
 *
 * @param name - The name of the resource.
 * @param url - The URL of the resource to load.
 * @returns A promise that resolves to the loaded resource.
 */
export const loadResource = (type: ResourceType, name: string, url: string): Promise<Resource> =>
	fetch(url)
		.then((res) => res.arrayBuffer())
		.then((rawData) => {
			let data;

			switch (type) {
				case 'utf-8': data = new TextDecoder('utf-8').decode(rawData); break
				default: data = rawData; break
			}

			return ({ name, url, type, loaded: true, data })
		});

/**
 * Adds a new resource to the manager for tracking.
 *
 * @param name - The name of the resource.
 * @param url - The URL of the resource.
 * @param manager - The manager to update.
 */
export const addResource = (manager: Manager, type: ResourceType, name: string, url: string): void => {
	if (!manager.resources.has(name)) {
		manager.resources.set(name, { name, url, type, loaded: false });
		manager.totalCount += 1;
	}
};

/**
 * Updates the loaded status of a resource in the manager.
 *
 * @param name - The name of the resource to update.
 * @param loaded - The new loaded status of the resource.
 * @param manager - The manager to update.
 */
export const updateResource = (name: string, loaded: boolean, manager: Manager): void => {
	const resource = manager.resources.get(name);

	if (resource) {
		if (resource.loaded !== loaded) {
			resource.loaded = loaded;
			manager.loadedCount += loaded ? 1 : -1;
		}
	}
};

/**
 * Computes the current loading progress of the resources in the manager.
 *
 * @param manager - The manager to compute progress from.
 * @returns An object containing the number of loaded and total resources.
 */
export const getProgress = (manager: Manager): Progress => ({
	loadedCount: manager.loadedCount,
	totalCount: manager.totalCount,
});

/**
 * Loads all resources in the manager and calls a callback after each resource is loaded.
 *
 * @param manager - The Manager containing resources to load.
 * @param callback - Optional callback invoked after each resource is loaded, with progress.
 */
export const loadAllResources = (
	manager: Manager,
	callback?: (progress: Progress, resource: Resource, manager: Manager) => void
): Promise<void> => {
	const resourcesArray = Array.from(manager.resources.values());

	return resourcesArray.reduce(
		(promiseChain, resource) =>
			promiseChain.then(() =>
				loadResource(resource.type, resource.name, resource.url).then((loadedResource) => {
					updateResource(loadedResource.name, loadedResource.loaded, manager);

					// Calculate progress and call the callback with it
					if (callback) {
						const progress = getProgress(manager);
						callback(progress, loadedResource, manager);
					}
				})
			),
		Promise.resolve()
	);
};
