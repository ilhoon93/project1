/** 5 free-tier templates for the main hero image. Order = display order. */
export const FREE_TEMPLATES = {
  classic_chapel: {
    label: '클래식 채플',
    icon: '🕯️',
    prompt:
      'Change the background to an elegant white wedding chapel with tall white candles and white roses. ' +
      'Change the outfits to classic wedding attire: groom in a black tuxedo, bride in a white lace wedding gown. ' +
      'Warm golden candlelight, soft cinematic atmosphere, photorealistic.',
  },
  garden: {
    label: '야외 가든',
    icon: '🌸',
    prompt:
      'Change the background to a lush outdoor garden with a floral arch and white flowers in soft morning light. ' +
      'Change the outfits to elegant wedding attire — groom in a light suit, bride in a flowing wedding gown. ' +
      'Photorealistic, romantic, fresh.',
  },
  hanok: {
    label: '한옥 정원',
    icon: '🏮',
    prompt:
      'Change the background to a traditional Korean Hanok courtyard with pine trees and falling cherry blossoms. ' +
      'Change the outfits to elegant western wedding attire — groom in a black tuxedo, bride in a white gown. ' +
      'Warm afternoon light, photorealistic.',
  },
  modern: {
    label: '모던 화이트',
    icon: '🤍',
    prompt:
      'Change the background to a sleek modern wedding hall with white walls and minimalist decor. ' +
      'Change the outfits to contemporary wedding attire — groom in a fitted black tuxedo, bride in a sculptural white gown. ' +
      'Dramatic natural lighting, editorial style, photorealistic.',
  },
  vintage: {
    label: '빈티지 성당',
    icon: '🏛️',
    prompt:
      'Change the background to a vintage European chapel with stone archways and tall candelabras. ' +
      'Change the outfits to elegant wedding attire — groom in a tailored tuxedo, bride in a classic lace gown. ' +
      'Soft dusty light, romantic vintage tone, photorealistic.',
  },
} as const satisfies Record<string, { label: string; icon: string; prompt: string }>;

export type TemplateKey = keyof typeof FREE_TEMPLATES;

export const TEMPLATE_KEYS = Object.keys(FREE_TEMPLATES) as TemplateKey[];

export const isTemplateKey = (v: string): v is TemplateKey =>
  Object.hasOwn(FREE_TEMPLATES, v);
