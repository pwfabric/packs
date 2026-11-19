/** Every widgets block survives a prop of the wrong type (tools/test-support/wrong-type-sweep.tsx). */
import { describe, it, expect } from 'vitest'
import { sweepWrongTypes } from '../../../tools/test-support/wrong-type-sweep.js'
import { TreeViewBlock } from '../atoms/blocks/container/tree-view/component.js'
import { LikeButtonBlock } from '../atoms/blocks/control/like-button/component.js'
import { CalendarMonthBlock } from '../atoms/blocks/data/calendar-month/component.js'
import { ChartBlock } from '../atoms/blocks/data/chart/component.js'
import { RatingBlock } from '../atoms/blocks/data/rating/component.js'
import { WorldClockBlock } from '../atoms/blocks/data/world-clock/component.js'
import { ComboboxBlock } from '../atoms/blocks/form/combobox/component.js'
import { FileDropzoneBlock } from '../atoms/blocks/form/file-dropzone/component.js'
import { RichTextEditorBlock } from '../atoms/blocks/form/rich-text-editor/component.js'
import { SliderBlock } from '../atoms/blocks/form/slider/component.js'
import { TagInputBlock } from '../atoms/blocks/form/tag-input/component.js'
import { CarouselBlock } from '../atoms/blocks/media/carousel/component.js'
import { EmbedBlock } from '../atoms/blocks/media/embed/component.js'
import { GalleryBlock } from '../atoms/blocks/media/gallery/component.js'
import { InteractiveMapBlock } from '../atoms/blocks/media/interactive-map/component.js'
import { VideoBlock } from '../atoms/blocks/media/video/component.js'
import { CommandPaletteBlock } from '../atoms/blocks/overlay/command-palette/component.js'

if (typeof window.matchMedia !== 'function') {
  window.matchMedia = ((q: string) => ({ matches: false, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false })) as never
}

describe('widgets blocks and props of the wrong type', () => {
  it('no block throws when a prop arrives as another JSON type (an unresolved binding, a wrong field)', () => {
    const crashes = sweepWrongTypes([
      { type: 'tree-view', component: TreeViewBlock },
      { type: 'like-button', component: LikeButtonBlock },
      { type: 'calendar-month', component: CalendarMonthBlock },
      { type: 'chart', component: ChartBlock },
      { type: 'rating', component: RatingBlock },
      { type: 'world-clock', component: WorldClockBlock },
      { type: 'combobox', component: ComboboxBlock },
      { type: 'file-dropzone', component: FileDropzoneBlock },
      { type: 'rich-text-editor', component: RichTextEditorBlock },
      { type: 'slider', component: SliderBlock },
      { type: 'tag-input', component: TagInputBlock },
      { type: 'carousel', component: CarouselBlock },
      { type: 'embed', component: EmbedBlock },
      { type: 'gallery', component: GalleryBlock },
      { type: 'interactive-map', component: InteractiveMapBlock },
      { type: 'video', component: VideoBlock },
      { type: 'command-palette', component: CommandPaletteBlock },
    ])
    expect(crashes.join(String.fromCharCode(10))).toBe('')
  }, 120_000)
})
