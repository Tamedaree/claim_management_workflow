const isNode = typeof window === 'undefined';

/**
 * Minimal Storage-shaped stub used in non-browser (SSR/Node) environments
 * where window.localStorage doesn't exist. Matches the subset of the
 * Storage interface this file actually uses.
 * @type {{ setItem: (key: string, value: string) => void, getItem: (key: string) => string | null, removeItem: (key: string) => void }}
 */
const nodeStorageStub = {
	setItem: () => {},
	getItem: () => null,
	removeItem: () => {},
};

const storage = isNode ? nodeStorageStub : window.localStorage;

/**
 * @param {string} str
 * @returns {string}
 */
const toSnakeCase = (str) => {
	return str.replace(/([A-Z])/g, '_$1').toLowerCase();
}

/**
 * @param {string} paramName
 * @param {{ defaultValue?: string, removeFromUrl?: boolean }} [options]
 * @returns {string | null}
 */
const getAppParamValue = (paramName, { defaultValue = undefined, removeFromUrl = false } = {}) => {
	if (isNode) {
		return defaultValue ?? null;
	}
	const storageKey = `app_${toSnakeCase(paramName)}`;
	const urlParams = new URLSearchParams(window.location.search);
	const searchParam = urlParams.get(paramName);
	if (removeFromUrl) {
		urlParams.delete(paramName);
		const newUrl = `${window.location.pathname}${urlParams.toString() ? `?${urlParams.toString()}` : ""
			}${window.location.hash}`;
		window.history.replaceState({}, document.title, newUrl);
	}
	if (searchParam) {
		storage.setItem(storageKey, searchParam);
		return searchParam;
	}
	if (defaultValue !== undefined) {
		storage.setItem(storageKey, defaultValue);
		return defaultValue;
	}
	const storedValue = storage.getItem(storageKey);
	if (storedValue) {
		return storedValue;
	}
	return null;
}

const getAppParams = () => {
	if (getAppParamValue("clear_access_token") === 'true') {
		storage.removeItem('app_access_token');
	}
	return {
		token: getAppParamValue("access_token", { removeFromUrl: true }),
		fromUrl: getAppParamValue("from_url", { defaultValue: window.location.href }),
	}
}

export const appParams = {
	...getAppParams()
}