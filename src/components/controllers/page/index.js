import { h } from 'preact';
import { useEffect, useState, useMemo } from 'preact/hooks';
import cx from '../../../lib/cx';
import ContentRegion, { getContentOnServer } from '../../content-region';
import config from '../../../config';
import style from './style';
import Footer from '../../footer';
import Sidebar from './sidebar';
import Hydrator from '../../../lib/hydrator';
import EditThisPage from '../../edit-button';
import {
	getPrerenderData,
	InjectPrerenderData
} from '../../../lib/prerender-data';
import { isDocPage } from '../../../lib/docs';
import { useStore } from '../../store-adapter';

const getContent = route => route.content || route.path;

/**
 * Set `document.title`
 * @param {string} title
 */
export function useTitle(title) {
	useEffect(() => {
		if (title) {
			document.title = `${title} | ${config.title}`;
		}
	}, [title]);
}

/**
 * Set the meta description tag content
 * @param {string} text
 */
export function useDescription(text) {
	useEffect(() => {
		const el = document.querySelector('meta[name=description]');
		if (text && el) {
			el.setAttribute('content', text);
		}
	}, [text]);
}

const noop = () => {};

export function usePage(route, lang) {
	// on the server, pass data down through the tree to avoid repeated FS lookups
	if (PRERENDER) {
		const { content, meta } = getContentOnServer(route.path, lang);
		return {
			current: null,
			content,
			meta,
			loading: true, // this is important since the client will initialize in a loading state.
			onLoad: noop
		};
	}

	const [current, setCurrent] = useState(getContent(route));

	const bootData = getPrerenderData(current);

	const [hydrated, setHydrated] = useState(!!bootData);
	const content = hydrated && bootData && bootData.content;
	console.log('BOOT CONTENT: ', content);

	const [loading, setLoading] = useState(true);
	const [isFallback, setFallback] = useState(false);
	let [meta, setMeta] = useState(hydrated ? bootData.meta : {});
	if (hydrated) meta = bootData.meta;

	useEffect(() => {
		if (!didLoad) {
			setLoading(true);
		}
	}, [getContent(route)]);

	useTitle(meta.title);
	useDescription(meta.description);

	let didLoad = false;
	function onLoad(data) {
		const { meta, fallback } = data;
		didLoad = true;

		// Don't show loader forever in case of an error
		if (!meta) {
			return;
		}

		setMeta(meta);
		setLoading(false);
		setFallback(fallback);
		const current = getContent(route);
		const bootData = getPrerenderData(current);
		setHydrated(!!bootData);
		setCurrent(current);
		// content was loaded. if this was a forward route transition, animate back to top
		if (window.nextStateToTop) {
			window.nextStateToTop = false;
			scrollTo({
				top: 0,
				left: 0,
				behavior: 'smooth'
			});
		}
	}

	return {
		current,
		content,
		meta,
		loading,
		onLoad,
		isFallback
	};
}

export default function Page({ route }) {
	const store = useStore(['toc', 'url', 'lang']);
	const { loading, meta, content, current, onLoad, isFallback } = usePage(
		route,
		store.state.lang
	);
	const urlState = store.state;
	const url = useMemo(() => urlState.url, [current]);

	const layout = `${meta.layout || 'default'}Layout`;
	const name = getContent(route);

	const isReady = !loading && urlState.toc != null;

	// Note:
	// "name" is the exact page ID from the URL
	// "current" is the currently *displayed* page ID.

	const showTitle = current != 'index' && meta.show_title !== false;
	const canEdit = showTitle && current != '404';
	const hasSidebar = meta.toc !== false && isDocPage(url);

	return (
		<div class={cx(style.page, style[layout], hasSidebar && style.withSidebar)}>
			<progress-bar showing={loading} />
			<div class={style.outer}>
				<Hydrator
					wrapperProps={{ class: style.sidebarWrap }}
					component={Sidebar}
					boot={isReady}
					show={hasSidebar}
				/>
				<div class={style.inner}>
					<Hydrator
						boot={isReady}
						component={EditThisPage}
						show={canEdit}
						isFallback={isFallback}
					/>
					<Hydrator
						component={Title}
						boot={isReady}
						show={showTitle}
						title={meta.title || route.title}
					/>
					<ContentRegion name={name} content={content} onLoad={onLoad} />
					<Footer />
				</div>
			</div>
			<InjectPrerenderData name={name} data={{ content, meta }} />
		</div>
	);
}

const Title = ({ title, show }) => show && <h1 class={style.title}>{title}</h1>;
