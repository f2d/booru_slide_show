
//* TODO: checkbox: sequential search iteration, or random order.
//* TODO: checkbox/radio: light theme / dark / change with system time.
//* TODO: textareas: export to json/txt file, export all settings, dragndrop settings from file, button to sort + deduplicate list.
//* TODO: gelbooru, etc

var	LS = window.localStorage || localStorage
,	NS = 'slideshow-'
,	NH = NS + 'history-'
,	LP = NS + 'last-shown-pic'
,	attrPicURL = 'data-show-pic'
,	la
,	bgContainer
,	timeout
,	config = {
		'default': {
			'display-time': '60'
		,	'search-sites': [
				'shima.donmai.us',
				// '- danbooru.donmai.us donmai.us - may be blocked or not',
				// '- gelbooru.com - TODO',
				// '- artstation.com - TODO',
			]
		,	'search-tags': ''
		}
	,	'restored': {}		//* <- what was restored on page start, may be restored again later
	,	'lastEntered': {}	//* <- what was entered by user, if valid and not default
	}
,	regSpace         = /\s+/g
,	regSlash         = /[\\\/]/g
,	regNewLine       = /[\r\n]+/g
,	regTrim          = /^\s+|\s+$/g
,	regTrimNewLine   = /[^\S\r\n]*(\r\n|\r|\n)/g
,	regHMS           = /(T\d+)-(\d+)-(\d+\D*)/
,	regInputTagNames = /^(button|input|textarea)$/i
,	regInsideFunc    = /\{[^.]+\.([^(]+)\(/
,	regURLSiteName   = /^(\w+:\/\/+)?([^\/]+)(\/.*?)?$/
,	TOS = ['object','string']
,	imageTypes = ['bmp', 'gif', 'jpg', 'jpeg', 'png']
,	splitSec = 60
,	maxEventLogLines = 9
,	maxHistoryPics = 99
,	maxTagLinks = 5
,	commentDelim = '-'
,	titleNewLine = ' \r\n'
,	linkPixivIllustByID = 'https://www.pixiv.net/member_illust.php?mode=medium&illust_id='
;

//* Utility functions *--------------------------------------------------------

function gc(n,p) {try {return TOS.slice.call((p || document).getElementsByClassName(n) || []);} catch(e) {return [];}}
function gt(n,p) {try {return TOS.slice.call((p || document).getElementsByTagName(n) || []);} catch(e) {return [];}}
function gn(n,p) {try {return TOS.slice.call((p || document).getElementsByName(n) || []);} catch(e) {return [];}}
function id(i) {return document.getElementById(i);}
function cre(e,p,b) {
	e = document.createElement(e);
	if (b) p.insertBefore(e, b); else
	if (p) p.appendChild(e);
	return e;
}

function del(e,p) {
	if (!e) return;
	if (e.map) e.map(del); else
	if (p?p:p = e.parentNode) p.removeChild(e);
	return p;
}

function eventStop(e,i,d) {
	if ((e && e.eventPhase !== null) ? e : (e = window.event)) {
		if (d && e.preventDefault) e.preventDefault();
		if (i && e.stopImmediatePropagation) e.stopImmediatePropagation();
		if (e.stopPropagation) e.stopPropagation();
		if (e.cancelBubble !== null) e.cancelBubble = true;
	}
	return e;
}

function toggleClass(e,c,keep) {
var	j = orz(keep)
,	k = 'className'
,	old = e[k] || e.getAttribute(k) || ''
,	a = old.split(regSpace).filter(arrayFilterNonEmptyValues)
,	i = a.indexOf(c)
	;
	if (i < 0) {
		if (j >= 0) a.push(c);
	} else {
		if (j <= 0) a.splice(i, 1);
	}
	if (a.length) {
		j = a.join(' ');
		if (old != j) e[k] = j;
	} else
	if (old) {
		e[k] = '';
		e.removeAttribute(k);
	}
}

function trim(t) {
	return (
		typeof t === 'undefined'
	||	t === null
		? ''
		: ('' + t)
			.replace(regTrim, '')
			.replace(regTrimNewLine, '\n')
	);
}

function orz(n) {return parseInt(n || 0) || 0;}
function leftPad(n, len, pad) {
	n = '' + orz(n);
	len = orz(len) || 2;
	pad = '' + (pad || 0);
	while (n.length < len) n = pad+n;
	return n;
}

function decodeHTMLSpecialChars(t) {
	return String(t)
	.replace(/&nbsp;/gi, ' ')
	.replace(/&lt;/gi, '<')
	.replace(/&gt;/gi, '>')
	.replace(/&quot;/gi, '"')
	.replace(/&#0*39;/g, "'")
	.replace(/&amp;/gi, '&');
}

function encodeHTMLSpecialChars(t) {
	return String(t)
	.replace(/&/g, '&amp;')
	.replace(/"/g, '&quot;')
	.replace(/'/g, '&#39;')
	.replace(/</g, '&lt;')
	.replace(/>/g, '&gt;');
}

function encodeTagAttr(t) {
	return String(t).replace(/"/g, '&quot;');
}

function getTagAttrIfNotEmpty(name, values, delim) {
	if (name && values) {
	var	a = (values.filter ? values : [values]).filter(function(v) {return !!v;});
		if (a.length) return ' ' + name + '="' + encodeTagAttr(a.join(delim || ' ')) + '"';
	}
	return '';
}

function getTagsForURL(t) {
	return (
		t
		? t.split(regSpace).map(encodeURIComponent).join('+')
		: ''
	);
}

function getFormattedTimezoneOffset(t) {
	return (
		(t = (t && t.getTimezoneOffset ? t : new Date()).getTimezoneOffset())
		? (t < 0?(t = -t, '+'):'-') + leftPad(Math.floor(t/splitSec)) + ':' + leftPad(t%splitSec)
		: 'Z'
	);
}

function getFormattedHMS(msec) {
var	t = orz(msec)
,	a = [0, 0, Math.floor(Math.abs(t) / 1000)]
,	i = a.length
	;
	while (--i) {
		if (a[i] >= splitSec) {
			a[i - 1] = Math.floor(a[i] / splitSec);
			a[i] %= splitSec;
		}
		if (a[i] < 10) a[i] = '0' + a[i];
	}
	return (t < 0?'-':'') + a.join(':');
}

function getLogTime() {return getFormattedTime(0,1);}
function getFormattedTime(sec, for_log, for_filename, plain, only_ymd) {
var	t = sec;
	if (TOS.indexOf(typeof t) > -1) {
	var	text = '' + t
	,	n = orz(sec)
		;
		if (typeof t === 'string' && Date.parse) {
			t = Date.parse(t.replace(regHMS, '$1:$2:$3'));
		} else {
			t = n * 1000;
		}
		if (!t && text) return text;
	}
var	d = (t ? new Date(t+(t > 0 ? 0 : new Date())) : new Date())
,	a = (
		only_ymd
		? ['FullYear', 'Month', 'Date']
		: ['FullYear', 'Month', 'Date', 'Hours', 'Minutes', 'Seconds']
	).map(function(v,i) {
		v = d['get'+v]();
		if (i == 1) ++v;
		return leftPad(v);
	})
,	YMD = a.slice(0,3).join('-')
,	HIS = a.slice(3).join(for_filename?'-':':') + (for_log?'.'+((+d) % 1000):'')
	;
	return (
		for_log || for_filename || plain
		? YMD + (for_filename?'_':' ') + HIS
		: (
			'<time datetime="'
		+	YMD + 'T'
		+	HIS
		+	getFormattedTimezoneOffset(t)
		+	'" data-t="' + Math.floor(d/1000)
		+	'">'
		+		YMD
		+		' <small>'
		+			HIS
		+		'</small>'
		+	'</time>'
		)
	);
}

function arrayFilterNonEmptyValues(v) {return !!v;}
function arrayFilterUniqueValues(v,i,a) {return a.indexOf(v) === i;}

function getRandomArrayItem(a) {return a[Math.floor(Math.random() * a.length)];}
function getUniqueLines(text) {return getUniqueValues(text, regNewLine, null);}
function getUniqueWords(text) {return getUniqueValues(text, regSpace);}
function getUniqueValues(text, splitDelim, joinDelim, skipDelim) {
var	v = '' + text
,	a = v.split(splitDelim || regSpace)
,	a = a
		.filter(arrayFilterNonEmptyValues)
		.filter(arrayFilterUniqueValues)
	;
	if (skipDelim !== null) {
	var	skipStart = a.indexOf(skipDelim || commentDelim);
		if (skipStart >= 0) a = a.slice(0, skipStart)
	}
	if (joinDelim !== null) {
		a = a.join(joinDelim || ' ');
	}
	return a;
}

function getURLSiteName(url) {
var	url = url.replace(regSlash, '/')
,	m = url.match(regURLSiteName)
	;
	return (m ? m[2] : url).toLowerCase();
}

function getValueById(i) {
var	e = id(i);
	return (e ? e.value || '' : '');
}

function getLinesById(i,f) {
var	v = getUniqueLines(getValueById(i));
	if (f) v = v.map(f);
	return (
		v
		.map(getUniqueWords)
		.map(trim)
		.filter(arrayFilterNonEmptyValues)
		.filter(arrayFilterUniqueValues)
	);
}

function setColorBlink(e,c,t) {
	if (
		e
	&&	(
			e.tagName
		||	(e = id(e))
		)
	) {
		if (t = e.timeout) clearTimeout(t);

		e.style.backgroundColor = c || '#ffa07a';

		e.timeout = setTimeout(function() {
			e.style.backgroundColor = '';
		}, 500);
	}
}

//* Page-specific functions *--------------------------------------------------

function logVar(k, v) {
var	t = getLogTime();
	if (typeof k !== 'undefined') t += ' - ' + k;
	if (typeof v !== 'undefined') {
		if (v.join) v = v.join('\n');
		if (v.indexOf && v.indexOf('\n') >= 0) {
			if (
				(v[0] == '(' && ')' == v.slice(-1))
			||	(v[0] == '{' && '}' == v.slice(-1))
			||	(v[0] == '[' && ']' == v.slice(-1))
			) {
				t += ':\n' + v;
			} else {
				t += ':\n[\n' + v + '\n]';
			}
		} else {
			t += ' = "' + v + '"';
		}
	}
	console.log(t);

	if (v = newHistoryElement(
		'status-text'
	,	'status-log'
	)) v.textContent = t;
}

function newHistoryElement(newParentID, oldParentID, newElementID, maxCount, tagName) {
var	e,f,k,v
,	newP = id(newParentID)
,	oldP = id(oldParentID)
	;
	if (newP) {
		if (e = newP.firstElementChild) {
			if (oldP) {
				if (f = oldP.firstElementChild) {
					oldP.insertBefore(e, f);

					if (newElementID && (e = id(newElementID))) {
						newP.appendChild(e);
						return e;
					}
				} else {
					while (f = oldP.firstChild) del(f);
					oldP.appendChild(e);
				}
				if (f = oldP.firstElementChild) {
					for (var i = 0, k = maxCount || maxEventLogLines; f && i < k; i++) f = f.nextElementSibling;
					if (f) while (e = f.nextElementSibling) {
						if (
							(v = e.id)
						&&	(k = NH + v)
						&&	(LS[k])
						) {
							LS.removeItem(k);
						}
						del(e);
					}
				}
			}
		} else {
			while (f = newP.firstChild) del(f);
		}
		return cre(tagName || 'div', newP);
	}
}

function saveConfig(i,v) {
	if (typeof v === 'undefined') v = getValueById(i);

	if (
		(v = trim(v))
	&&	trim(config.lastEntered[i]) != v
//	&&	(
//			i == 'display-time'
//		||	trim(config['default'][i]) != v
//		)
	) {
		if (trim(config.restored[i]) != v) {
			config.lastEntered[i] = v;

			logVar('updated ' + i, v);

			b = '#eda';
		}

	var	b,k = NS + i;
		if (trim(LS[k]) != v) {
			LS[k] = v;

			logVar('stored ' + i, v);

			b = '#dfc';
		}
	}

	if (b) setColorBlink(i,b);
}

function setDisplayTime() {
	if (timeout) timeout = clearTimeout(timeout);

var	i = 'display-time'
,	e = id(i)
,	v = orz(getValueById(i))
,	m
	;
	if (e) {
		if ((m = e.getAttribute('min')) !== null && v < (m = orz(m))) e.value = v = m;
		if ((m = e.getAttribute('max')) !== null && v > (m = orz(m))) e.value = v = m;
	}
	if (v > 0) {
		m = v * 1000;
		saveConfig(i, v);

		if (config.displayTime != m) {
			logVar('displayTime', v);

			config.displayTime = m;

			if (!config.paused) timeout = setTimeout(loadPic, m);
		}
	} else setColorBlink(i);
}

function setSearchSites() {
var	i = 'search-sites'
,	a = config.siteSets = getLinesById(i, getURLSiteName)
	;
	if (a.length > 0) {
		saveConfig(i);
		logVar('siteSets', a);
	} else setColorBlink(i);
}

function setSearchTags() {
var	i = 'search-tags'
,	a = config.tagSets = getLinesById(i)
	;
	if (a.length > 0) {
		saveConfig(i);
		logVar('tagSets', a);
	} else setColorBlink(i);
}

function setMemo() {
var	i = 'notepad'
,	v = trim(getValueById(i))
	;
	if (v.length > 0) {
		saveConfig(i);
		logVar('notepad', v);
	} else setColorBlink(i);
}

function setTextareaSize(e) {
	if (e = eventStop(e,1)) {
	var	t = e.target
	,	a = gt(t.tagName, t.parentNode)
	,	i = a.length
	,	w = t.style.width
		;
		while (i--) if ((e = a[i]) && e !== t) e.style.width = w;
	}
}

function addToSearchTags(v) {
var	e = id('search-tags')
	e.value += '\n' + v;
	e.onchange();

	logVar('added tag', v);
}

function setFocus  () {toggleClass(bgContainer, 'focus', 1);}
function unsetFocus() {toggleClass(bgContainer, 'focus', -1);}
function pause  (e) {setPause(e,1);}
function unpause(e) {setPause(e,0);}
function setPause(e,v) {
	if (e = eventStop(e,1)) {
		if (
			e.target !== e.currentTarget
		||	('which' in e && e.which !== 1)
		) return false;
	}

var	v = (typeof v === 'undefined' ? !config.paused : !!v)
,	c = (v ? 'paused' : 'unpaused')
,	e = id('buttons')
	;

	if (
		config.paused != v
	||	e.className != c
	) {
		config.paused = v;
		logVar(e.className = c);
	}

	if (v) {
		if (timeout) timeout = clearTimeout(timeout);
	} else {
		if (!timeout) loadPic();
	}
}

function getAPIbySite(site) {
var	a;
	site = getURLSiteName(site);
/*
	if (/(^|\.)gelbooru\.com/i.test(site)) a = {
		posts:        'https://' + site + '/index.php?page=post&s=view&id='
	,	searchByTags: 'https://' + site + '/index.php?page=post&s=list&tags='
	,	random:       'https://' + site + '/index.php?page=dapi&json=1&s=post&q=index&limit=1'
	,	randomByTags: 'https://' + site + '/index.php?page=dapi&json=1&s=post&q=index&limit=1&tags='
	};
*/
	return a || {
		posts:        'https://' + site + '/posts/'
	,	searchByTags: 'https://' + site + '/posts?tags='
	,	random:       'https://' + site + '/posts/random.json'
	,	randomByTags: 'https://' + site + '/posts/random.json?tags='
	};
}

function loadPic() {
	if (config.loading) return logVar('loading still in progress.');

	logVar('loading new pic');

	if (timeout) timeout = clearTimeout(timeout);

var	siteSets = config.siteSets
,	tagSets = config.tagSets
	;
	if (tagSets) {
	var	tagSet = getRandomArrayItem(tagSets)
	,	tags = getTagsForURL(tagSet)
		;
		logVar('selected tag set', tagSet);
	}

	if (siteSets) {
	var	siteSet = getRandomArrayItem(siteSets)
	,	site = getRandomArrayItem(siteSet.split(regSpace))
		;
		logVar('selected site set', siteSet);
		logVar('selected site', site);
	}

	if (site) {
	var	siteAPI = getAPIbySite(site)
	,	requestURL = (
			tags
			? siteAPI.randomByTags + tags
			: siteAPI.random
			)
		;
		logVar('loading URL', requestURL);

		config.loading = true;
		toggleClass(bgContainer, 'loading', 1);

	var	request = new XMLHttpRequest();
		request.siteAPI = siteAPI;
		request.open('GET', requestURL, true);

		if (request.addEventListener) {
			request.addEventListener('progress', onLoadProgress, false);
			request.addEventListener('loadend', onLoadEnd, false);
		} else {
			request.onreadystatechange = onLoadStateChange;
		}

		request.send();	//* <- "Uncaught exception: ReferenceError: Security violation" in opera11 (CORS-related)
	}
}

function onLoadStateChange(e) {
var	request = (e ? (e.target || e || this) : this);

	try {
		if (request.readyState == 4) {
			onLoadEnd(e);
		} else {
			logVar('loading state', request.readyState);
		}
	} catch (err) {
		logVar('response', request);
		logVar('error', err);

		config.loading = false;
		toggleClass(bgContainer, 'loading', -1);

		pause();
	}
}

function onLoadProgress(e) {
	if (e && e.loaded) {
		logVar('loaded', e.loaded + (
			e.total
			? (' / ' + e.total)
			: ''
		) + ' bytes');
	}
}

function onLoadEnd(e) {
var	request = (e ? (e.target || e || this) : this);

	if (timeout) timeout = clearTimeout(timeout);

	config.loading = false;
	toggleClass(bgContainer, 'loading', -1);
	try {
	var	r_status = request.status
	,	r_text = request.responseText
	,	r_data
		;

		if (r_status == 200) {
			r_data = JSON.parse(r_text);

			logVar('response', JSON.stringify(r_data, null, '\t'));

			r_data.siteAPI = request.siteAPI;
			r_text = JSON.stringify(r_data);

			loadPicFromData(r_text);
		} else {
			logVar('response', r_text);
			logVar('error', r_status);
		}
	} catch (err) {
		logVar('response', request);
		logVar('error', err);
	}
	if (!config.paused && orz(v = config.displayTime) > 0) timeout = setTimeout(loadPic, v);
}

function loadPicFromData(r_text, load_from_history) {
	if (
		(r_data = JSON.parse(r_text))
	&&	(i = r_data.id)
	&&	(preloadURL =
			r_data.large_file_url
		||	r_data.file_url
		||	r_data.preview_file_url
		)
	) {
	var	r_data
	,	siteAPI      = r_data.siteAPI || {}
	,	searchByTags = siteAPI.searchByTags
	,	postPageURL  = siteAPI.posts + i
	,	previewURL   = r_data.preview_file_url || preloadURL
	,	downloadURL  = r_data.file_url         || preloadURL
	,	fileExt      = r_data.file_ext         || preloadURL.split(/\./g).pop()
	,	fileHash     = r_data.md5
	,	preloadURL   = (
			imageTypes.indexOf(fileExt) >= 0
			? preloadURL
			: previewURL
		)
	,	w = r_data.image_width
	,	h = r_data.image_height
	,	li = la.pic_info
	,	a,e,f,g,h,i,j,k,v
		;

		if (
			(e = showPic(fileHash, preloadURL, load_from_history))
		&&	!e.id
		) {
			function getLink(link, text) {
				if (link.indexOf('/') < 0) {
					return (text || link);
				}

				if (('' + text).length <= 0) {
				var	a = link.replace(/^\/+|\/+$/g, '').split(/\/+/g);
					text = (
						a[0].substr(0,4).toLowerCase() == 'http'
						? a[1]
						: a.pop()
					);
				}

				return '<a href="'
				+		link
				+	'" target="_blank" referrerpolicy="no-referrer">'
				+		(text || link)
				+	'</a>';
			}
			function getAddLink(v) {
				return '<a href="javascript:addToSearchTags(\''
				+		encodeHTMLSpecialChars(v)
				+	'\')" title="'
				+		la.add_tag
				+	'">[+]</a>';
			}

		var	allTags = r_data.tag_string
		,	t = ''
		,	a = [
				[li.time_shown, getFormattedTime()]
			,	(v = r_data[k = 'updated_at']) ? [li.time_updated, getFormattedTime(v)] : ''
			,	(v = r_data[k = 'created_at']) ? [li.time_created, getFormattedTime(v)] : ''
			,	(v = r_data[k = 'rating']) ? [li.rating, li.ratings[v] || v] : ''
			,	(v = r_data[k = 'md5'   ]) ? [li.hash, v] : ''
			,	[li.download,
					getLink(downloadURL,
						r_data.file_ext + ', '
					+	w + 'x'
					+	h + ', '
					+	r_data.file_size + ' B'
					// +	li.bytes
					)
				]
			,	(v = r_data[k = 'source'  ]) ? [li.source, getLink(v, '')] : ''
			,	(v = r_data[k = 'pixiv_id']) ? [li.pixiv_id, getLink(linkPixivIllustByID + v, v)] : ''
			].concat(
				[
					['by'  , 'tag_string_artist']
				,	['from', 'tag_string_copyright']
				,	['char', 'tag_string_character']
				,	['meta', 'tag_string_meta']
				,	['etc' , 'tag_string_general']
				].map(function(v) {
				var	g = r_data[v[1]];
					if (g) {
						t += (
							t
							? titleNewLine + titleNewLine
							: ''
						) + li.tags[v[0]] + ': ' + g;
					var	a = g.split(regSpace)
					,	i = a.length
						;
						if (i > maxTagLinks) {
							a = a.slice(0, maxTagLinks).concat('');
						}
						return [
							li.tags[v[0]]
						,	a.map(function(v) {
								return (
									v
									? getAddLink(v) + ' '
									+ getLink(searchByTags + getTagsForURL(v), v)
									: '(... +' + (i - maxTagLinks) +')'
								);
							}).join('<br>')
						];
					}
					return '';
				})
			).filter(arrayFilterNonEmptyValues)
			.map(function(v) {
				return '<tr><td>'
				+	v.join(':</td><td>')
				+	'</td></tr>';
			})
			;

			if (fileHash) {
				e.id = fileHash;
				if (r_text && !LS[k = NH + fileHash]) LS[k] = r_text;
			}

			e.setAttribute(attrPicURL, preloadURL);
			e.className = 'pic-info';
			e.innerHTML = (
				'<div class="thumb-info">'
			+		'<table>'
			+			a.join('')
			+		'</table>'
			+	'</div>'
			+	'<div class="thumb">'
			+		'<div>'
			+			la.pic_info.booru + ':'
			+		'</div>'
			+		'<a href="'
			+			postPageURL
			+		'" style="'
			+			encodeTagAttr(
							'background-image: url("' + previewURL + '")'
						// +	'width: ' + w + 'px;'
						// +	'height: ' + h + 'px;'
						)
			+		'" title="'
			+			encodeTagAttr(t || allTags || 'no tags')
			+		'" onclick="return restorePic(this)" target="_blank" referrerpolicy="no-referrer">'
			// +			'<img src="' + previewURL + '" referrerpolicy="no-referrer">'
			+		'</a>'
			+	'</div>'
			);
		}

		logVar(
			load_from_history
			? 'loaded from history'
			: 'loaded new pic'
		, postPageURL);
	} else {
		logVar('error', la.error_not_found);
	}
}

function showPicInBG(e) {
	if (
		e
	||	(e = id('preload-pic') || id('image'))
	) {
		bgContainer.style.backgroundImage = 'url("' + (e.src || e) + '")';
	}
}

function showPic(fileHash, preloadURL, load_from_history) {
	if (!fileHash) return false;

	if (LS && LS[LP] != fileHash) LS[LP] = fileHash;

	if (!load_from_history) {
		if (
			!preloadURL
		&&	(e = id(fileHash))
		&&	(e = e.getAttribute(attrPicURL))
		) {
			preloadURL = e;
		}

		if (preloadURL) {
			if (e = id('preload-pic') || id('image')) {
				e.alt = e.src = preloadURL || '';
			} else {
				showPicInBG(preloadURL);
			}
		}
	}

	return newHistoryElement(
		'current-pic-info'
	,	'slideshow-history'
	,	fileHash
	,	maxHistoryPics
	);
}

function restorePic(e) {
	eventStop(0,1,1);

	if (e) {
		if (e.id) {
			e = e.id;
		} else
		while (e = e.parentNode) if (e.id) {
			e = e.id;
			break;
		}
		if (e) {
			logVar('restore pic id', e);
			showPic(e);
		}
	}

	return false;
}

function onKeyPress(e) {
	if (e = eventStop(e,1)) {
	var	t = e.target;
		if (
			t
		&&	t.tagName
		&&	regInputTagNames.test(t.tagName)
		) return false;

	var	i = orz(e.keyCode);
		if (i) {
		var	step = 10;

			//* up = 38 (arrows) or 104 (NumPad)
			if (i == 38 || i == 104) i = step; else

			//* down = 40 (arrows) or 98 (NumPad)
			if (i == 40 || i == 98) i = -step; else

			//* del = 46, backspace = 8
			if (i == 46 || i == 8) {
				return loadPic();
			} else

			//* space = 32
			if (i == 32) {
				return setPause();
			} else

			//* enter = 13
			if (i == 13) {
				return unpause();
			} else return;

			if (e = id('display-time')) {
				e.value = orz(e.value) + i;
				e.onchange();
			}
		}
	}
}

function getSVGButtonHTML(id, onclick, data, encode) {
	if (data) {
		data = (
			'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" fill="currentColor">'
		+		data
		+	'</svg>'
		);

//* Note: embedded object is more complicated to style.

		if (encode) {
			data = (
				'<object type="image/svg+xml" data="data:image/svg+xml;'

//* Note: data URIs do not have to be base64.
//* Source: https://css-tricks.com/using-svg/#format-for-data-uri

				// + 'base64,'
				// + btoa(

				+ 'charset=UTF-8,'
				+ encodeURIComponent(data)
				+ '">'
			+		'<script>'
			+			'id("' + id + '").innerHTML = "";'
			+		'</script>'
			+	'</object>'
			);
		}
	}

	return (
		'<button id="' + id + '" onclick="' + onclick + '">'
	+		(data || '')
	+	'</button>'
	);
}

function init() {
	logVar('init started.');

	bgContainer = (
		document.body.parentNode
	||	document.body
	);

	bgContainer.addEventListener('click', pause, false);
	document.body.addEventListener('keydown', onKeyPress, false);

var	pauseButtonSVG = '<polygon points="32,32 56,32 56,96 32,96 "/><polygon points="72,32 96,32 96,96 72,96 "/>'
,	continueButtonSVG = '<polygon points="48,32 96,64 48,96 "/>'
,	reloadButtonSVG = ''
	;

	document.body.innerHTML = (
		'<div id="status" class="hide-out">'
	+		'<img id="preload-pic" onload="showPicInBG(this)" referrerpolicy="no-referrer">'
	// +		'<div id="progress-bar"><section id="progress-fill"></section></div>'
	+		'<section id="hint" class="right">[?]</section>'
	+		'<section id="status-text">[ No status ]</section>'
	+		'<section id="status-log" class="hide-in">[ No log ]</section>'
	+	'</div>'
	+	'<div id="panels">'
	+		'<aside id="control-panel" class="hide-out left">'
	+			'<section id="buttons">'
	+				getSVGButtonHTML('pause', 'pause()', pauseButtonSVG)
	+				getSVGButtonHTML('continue', 'unpause()', continueButtonSVG)
	+				getSVGButtonHTML('load-pic', 'loadPic()', reloadButtonSVG)
	+			'</section>'
	+			'<section id="config" class="hide-in">'
	+				'<input type="number" min="5" step="5" id="display-time" onchange="setDisplayTime()" /><br>'
	+				'<textarea id="search-sites" onchange="setSearchSites()"></textarea><br>'
	+				'<textarea id="search-tags"  onchange="setSearchTags()"></textarea><br>'
	+				'<textarea id="notepad"      onchange="setMemo()"></textarea>'
	+			'</section>'
	+		'</aside>'
	+		'<aside id="info-panel" class="hide-out right">'
	+			'<section id="current-pic-info">[ No current-pic-info ]</section>'
	+			'<section id="slideshow-history" class="hide-in">[ No slideshow-history ]</section>'
	+		'</aside>'
	+	'</div>'
	);

	if (LS) {
	var	f = false
	,	preloadedPic = false
	,	lastShownPic = LS[LP] || false
		;
		for (i = 0, j = LS.length; i < j; i++) {
			k = LS.key(i);
			if (k.indexOf(NH) === 0) {
				loadPicFromData(LS[k], 1);
				if (!f || f != lastShownPic) f = k.substr(NH.length);
			}
		}
		if (f) showPic(preloadedPic = f);
	}

var	eon = [
		'onchange'
	,	'onclick'
	]
,	a,e,f,i,j,k,v
	;

	for (i in la) if (e = id(i)) {
		e.name = i;

		if (j = config['default']) {
			if (i in j && (v = j[i]).join) {
				j[i] = v = v.join('\n');
			}

			if (LS[k = NS + i]) {
				e.value = v = config.restored[i] = LS[k];

				logVar('restored ' + i, v);
			} else
			if (i in j) {
				e.value = v;

				logVar('default ' + i, v);
			}
		}

		if ((j = la[i]).join) j = j.join(titleNewLine);
		e.title = e.placeholder = j;

		if (!preloadedPic || i != 'load-pic') {
			for (j in eon) if (f = e.getAttribute(eon[j])) eval(f);
		}
	}

var	eon = {
		'mouseup': setTextareaSize
	,	'focus': setFocus
	,	'blur': unsetFocus
	}
,	eof = [
		// 'input',
		'textarea'
	]
,	n = eof.length
	;

	while (n--) if (a = gt(eof[n])) {
		i = a.length;
		while (i--) if (e = a[i]) {
			for (j in eon) e.addEventListener(j, eon[j], false);
		}
	}

	logVar('init finished.');
}

//* Runtime *------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', init, false);
