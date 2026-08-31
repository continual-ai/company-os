import { defineRule } from "@oxlint/plugins"
import type { ESTree } from "@oxlint/plugins"

const APPLICATION_SURFACE = /[\\/](?:apps|templates)[\\/].*\.[cm]?tsx$/
const MARKETING_SITE = /[\\/]templates[\\/]marketing-site[\\/]/
const SCREEN_HEIGHT = /(?<![\w-])(?:min-)?h-screen(?![\w-])/g
const HERO_PADDING = /(?<![\w-])py-(?:16|20|24|28|32|36|40)(?![\w-])/g
const ARBITRARY_COLOR = /(?<![\w-])(?:bg|text|border)-\[#[^\]]*\]?/g

/** Keep application surfaces on the shared layout and color system. */
export const visualDriftRule = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Forbid screen-height sizing, hero-scale vertical padding, and arbitrary color literals in application TSX.",
    },
    messages: {
      screenHeight:
        'Avoid "{{className}}" in application surfaces. Size views against the app shell with flex-1 and min-h-0 so they compose inside the product frame.',
      heroPadding:
        'Avoid hero-scale vertical padding ("{{className}}") in application surfaces. Use the compact spacing scale; hero layouts belong to templates/marketing-site.',
      arbitraryColor:
        'Replace the arbitrary color literal "{{className}}" with a design token utility from @company/ui globals.css.',
    },
  },
  createOnce(context) {
    function checkText(node: ESTree.Node, text: string) {
      if (!APPLICATION_SURFACE.test(context.filename)) return
      const marketingSite = MARKETING_SITE.test(context.filename)
      if (!marketingSite) {
        for (const match of text.matchAll(SCREEN_HEIGHT)) {
          context.report({
            node,
            messageId: "screenHeight",
            data: { className: match[0] },
          })
        }
        for (const match of text.matchAll(HERO_PADDING)) {
          context.report({
            node,
            messageId: "heroPadding",
            data: { className: match[0] },
          })
        }
      }
      for (const match of text.matchAll(ARBITRARY_COLOR)) {
        context.report({
          node,
          messageId: "arbitraryColor",
          data: { className: match[0] },
        })
      }
    }

    return {
      Literal(node) {
        if (typeof node.value !== "string") return
        checkText(node, node.value)
      },
      TemplateLiteral(node) {
        for (const quasi of node.quasis) {
          checkText(node, quasi.value.cooked ?? quasi.value.raw)
        }
      },
    }
  },
})
