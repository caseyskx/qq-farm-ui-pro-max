import antfu from '@antfu/eslint-config'

export default antfu({
  vue: true,
  typescript: true,
  unocss: true,
  formatters: true,
}, {
  rules: {
    // Vue templates in this repo mix icon-only native tags and explicit close tags.
    // Avoid lint guidance that pushes developers back and forth between two forms.
    'vue/html-self-closing': ['error', {
      html: {
        void: 'any',
        normal: 'any',
        component: 'always',
      },
      svg: 'any',
      math: 'any',
    }],
  },
}, {
  files: ['__tests__/**/*.mjs'],
  rules: {
    'test/no-import-node-test': 'off',
  },
})
