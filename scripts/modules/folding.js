'use strict';

const {
  parseTagArgs,
  hasNamedArgs,
  splitClassNames,
  findNamedArgs,
  getQuotedNamedValue,
} = require('../utils/tag-args');
const { html } = require('../utils/html');
const { renderMarkdownTagSafe } = require('../utils/markdown-swig');

const FOLDING_NAMED_KEYS = new Set(['title', 'class', 'classes', 'style', 'open']);

function normalizeOpenValue(value) {
  const normalized = String(value ?? '').trim().toLowerCase();

  if (!normalized) {
    return false;
  }

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return false;
}

function parseNamedArgs(rawArgs) {
  const parsedArgs = parseTagArgs(rawArgs);
  const supportsNamed = Object.keys(parsedArgs.named)
    .some((key) => FOLDING_NAMED_KEYS.has(key));

  if (!hasNamedArgs(parsedArgs) || !supportsNamed) {
    return null;
  }

  const rawNamedArgs = findNamedArgs(rawArgs);
  const getNamedValue = (key) =>
    getQuotedNamedValue(rawArgs, rawNamedArgs, parsedArgs.named, key, FOLDING_NAMED_KEYS);

  const classNames = [
    ...splitClassNames(getNamedValue('class')),
    ...splitClassNames(getNamedValue('classes')),
    ...splitClassNames(getNamedValue('style')),
  ];

  return {
    title: getNamedValue('title') || parsedArgs.positional.join(' ').trim(),
    className: classNames.join(' ').trim(),
    open: normalizeOpenValue(getNamedValue('open')),
  };
}

function parseLegacyArgs(rawArgs) {
  const delimiter = rawArgs.includes('::') ? '::' : ',';
  const [style = '', title = ''] = rawArgs.split(delimiter).map((arg) => arg.trim());

  return {
    title,
    className: style,
    open: false,
  };
}

async function postFolding(args, content) {
  const rawArgs = args.join(' ').trim();
  const parsed = parseNamedArgs(rawArgs) || parseLegacyArgs(rawArgs);

  const renderedContent = await renderMarkdownTagSafe({
    hexo,
    content,
    postContext: this,
  });

  const processedContent = renderedContent.replace(
    /<(h[1-6])>/g,
    (_, tag) => `<p class='${tag}'>`,
  ).replace(
    /<\/(h[1-6])>/g,
    () => '</p>',
  );

  const customClassAttr = parsed.className ? ` ${parsed.className}` : '';
  const openAttr = parsed.open ? ' open' : '';

  return html`
    <details class="relative my-4 border border-border-color bg-second-background-color rounded-md ${customClassAttr}"${openAttr} data-header-exclude>
      <summary class="px-4 py-2 rounded-md shadow-[0_0_2px_0_var(--shadow-color-1)] cursor-pointer not-markdown"><i class="fa-solid fa-chevron-right"></i>${parsed.title} </summary>
      <div class="content p-4 ">
        ${processedContent}
      </div>
    </details>
  `;
}

hexo.extend.tag.register('folding', postFolding, { ends: true, async: true });
