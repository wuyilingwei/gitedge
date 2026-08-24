import { describe, expect, it } from 'vitest'
import { i18n } from '../../apps/web/src/i18n'

describe('GitEdge product shell', () => {
  it('ships both Chinese and English product language keys', () => {
    expect(i18n.global.locale.value).toBe('zh-CN')
    expect(i18n.global.t('brand')).toBe('码锋')
    i18n.global.locale.value = 'en'
    expect(i18n.global.t('welcome')).toBe('Code at the edge')
    i18n.global.locale.value = 'zh-CN'
  })

  it('keeps the four repository navigation surfaces explicit', () => {
    expect(['code', 'issues', 'pulls', 'wiki']).toEqual(['code', 'issues', 'pulls', 'wiki'])
  })
})
