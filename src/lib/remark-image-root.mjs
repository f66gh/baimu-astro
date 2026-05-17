function isRootedOrExternalPath(value) {
	return (
		value.startsWith('/') ||
		value.startsWith('./') ||
		value.startsWith('../') ||
		value.startsWith('#') ||
		value.startsWith('//') ||
		/^[a-z][a-z\d+.-]*:/i.test(value)
	);
}

function joinImageRoot(imageRoot, imagePath) {
	const root = imageRoot.replace(/\/+$/, '');
	const path = imagePath.replace(/^\/+/, '');

	return `${root}/${path}`;
}

function visitImageNodes(node, imageRoot) {
	if (node?.type === 'image' && typeof node.url === 'string' && !isRootedOrExternalPath(node.url)) {
		node.url = joinImageRoot(imageRoot, node.url);
	}

	if (!Array.isArray(node?.children)) {
		return;
	}

	for (const child of node.children) {
		visitImageNodes(child, imageRoot);
	}
}

export default function remarkImageRoot() {
	return (tree, file) => {
		const imageRoot = file.data.astro?.frontmatter?.imageRoot;

		if (typeof imageRoot !== 'string' || imageRoot.trim().length === 0) {
			return;
		}

		visitImageNodes(tree, imageRoot.trim());
	};
}
