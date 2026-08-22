// Storage-format fidelity for WYSIWYG text editing.
//
// Text is STORED as raw HTML source and VIEWED through a one-way projection
// (module_text.inc.php, _text_render_content): it expands $BASEURL$ and
// friends, turns relative urls absolute, converts newlines to <br> and spaces
// to &nbsp;. Editing the VIEWED output and saving it back would bake every one
// of those in permanently, on the first edit of every text object - the exact
// failure MODERNIZATION.md section 8 item 2 warns about.
//
// So editing uses a separate, deliberately reversible render. This test is what
// says so: it opens each sample for editing, changes NOTHING, closes it, and
// compares the stored bytes.
//
// Three of the samples are expected to change, and only these three. They are
// the browser's HTML parser canonicalising markup - all render identically, and
// the first is a repair rather than a change. Anything else appearing in this
// list is content being silently rewritten, which is what the test is for.

const { test, expect, waitForEditor } = require('./fixtures/hotglue.js');
const CORPUS = [
  ['plain',            'hello world'],
  ['newlines',         'line one\nline two'],
  ['absolute link',    'see <a href="https://example.org/">this</a> now'],
  ['relative link',    'go to <a href="mypage">my page</a>'],
  ['anchor link',      'jump <a href="#part2">down</a>'],
  ['alias',            'base $BASEURL$ and page $page$'],
  ['inline tags',      'bold <b>text</b> and <i>italic</i>'],
  ['entities',         'amp &amp; lt &lt; raw & here'],
  ['nbsp char',        'nbsp here'],
  ['authored br',      'a<br>b'],
  ['uppercase tag',    'UPPER <A HREF="https://x.example/">link</A>'],
  ['unquoted attr',    'x <a href=https://y.example/>y</a>'],
  ['class on link',    '<a href="https://z.example/" class="cta">z</a>'],
];
test('editing and closing a text object does not rewrite its stored content', async ({ page, hg }) => {
  const attrs = { type:'text', module:'text','object-left':'50px','object-top':'50px',
    'object-width':'400px','object-height':'80px','object-zindex':'100','text-background-color':'transparent' };
  const ids = CORPUS.map(([label, content], i) =>
    hg.addObject('10000000000' + i, { ...attrs, 'object-top': (50 + i*90) + 'px' }, content));
  await page.goto(hg.editUrl());
  await waitForEditor(page, CORPUS.length);

  const results = [];
  for (let i = 0; i < CORPUS.length; i++) {
    const [label, original] = CORPUS[i];
    // enter editing then leave it, changing nothing
    await page.evaluate((id) => {
      const el = document.getElementById(id);
      el.classList.add('glue-selected');
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }, ids[i]);
    await page.waitForTimeout(60);
    await page.evaluate((id) => window.$.glue.text.stop_editing(document.getElementById(id)), ids[i]);
    await page.waitForTimeout(120);
    const stored = hg.readObject('10000000000' + i).content;
    results.push([label, original, stored, stored === original]);
  }
  // canonicalisation the browser's parser performs, and nothing else
  const EXPECTED_CHANGES = {
    'entities':      'amp &amp; lt &lt; raw &amp; here',   // invalid & repaired
    'uppercase tag': 'UPPER <a href="https://x.example/">link</a>',
    'unquoted attr': 'x <a href="https://y.example/">y</a>',
  };
  const unexpected = results.filter(([label, original, stored]) =>
    stored !== (EXPECTED_CHANGES[label] !== undefined ? EXPECTED_CHANGES[label] : original));
  expect(unexpected.map(([l, o, s]) => `${l}: ${JSON.stringify(o)} -> ${JSON.stringify(s)}`),
    'stored text content was rewritten by opening and closing the editor').toEqual([]);
});
