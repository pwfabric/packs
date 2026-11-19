/** Every foundation block survives a prop of the wrong type (tools/test-support/wrong-type-sweep.tsx). */
import { describe, it, expect } from 'vitest'
import { sweepWrongTypes } from '../../../tools/test-support/wrong-type-sweep.js'
import { AccordionBlock } from '../atoms/blocks/container/accordion/component.js'
import { CardBlock } from '../atoms/blocks/container/card/component.js'
import { TabsBlock } from '../atoms/blocks/container/tabs/component.js'
import { AvatarBlock } from '../atoms/blocks/control/avatar/component.js'
import { BadgeBlock } from '../atoms/blocks/control/badge/component.js'
import { BreadcrumbBlock } from '../atoms/blocks/control/breadcrumb/component.js'
import { ButtonBlock } from '../atoms/blocks/control/button/component.js'
import { ChipBlock } from '../atoms/blocks/control/chip/component.js'
import { CopyButtonBlock } from '../atoms/blocks/control/copy-button/component.js'
import { DividerBlock } from '../atoms/blocks/control/divider/component.js'
import { DropdownBlock } from '../atoms/blocks/control/dropdown/component.js'
import { IconBlock } from '../atoms/blocks/control/icon/component.js'
import { LinkBlock } from '../atoms/blocks/control/link/component.js'
import { PaginationBlock } from '../atoms/blocks/control/pagination/component.js'
import { ListBlock } from '../atoms/blocks/data/list/component.js'
import { MoneyBlock } from '../atoms/blocks/data/money/component.js'
import { ProgressBlock } from '../atoms/blocks/data/progress/component.js'
import { RepeaterBlock } from '../atoms/blocks/data/repeater/component.js'
import { SkeletonBlock } from '../atoms/blocks/data/skeleton/component.js'
import { TableBlock } from '../atoms/blocks/data/table/component.js'
import { RadialProgressBlock } from '../atoms/blocks/feedback/radial-progress/component.js'
import { SpinnerBlock } from '../atoms/blocks/feedback/spinner/component.js'
import { ToastBlock } from '../atoms/blocks/feedback/toast/component.js'
import { CheckboxBlock } from '../atoms/blocks/form/checkbox/component.js'
import { DateInputBlock } from '../atoms/blocks/form/date-input/component.js'
import { FormBlock } from '../atoms/blocks/form/form/component.js'
import { InputBlock } from '../atoms/blocks/form/input/component.js'
import { NumberStepperBlock } from '../atoms/blocks/form/number-stepper/component.js'
import { OtpInputBlock } from '../atoms/blocks/form/otp-input/component.js'
import { RadioBlock } from '../atoms/blocks/form/radio/component.js'
import { SegmentedControlBlock } from '../atoms/blocks/form/segmented-control/component.js'
import { SelectBlock } from '../atoms/blocks/form/select/component.js'
import { TextareaBlock } from '../atoms/blocks/form/textarea/component.js'
import { ToggleBlock } from '../atoms/blocks/form/toggle/component.js'
import { AnnouncementBarBlock } from '../atoms/blocks/layout/announcement-bar/component.js'
import { AppRailBlock } from '../atoms/blocks/layout/app-rail/component.js'
import { BottomBarBlock } from '../atoms/blocks/layout/bottom-bar/component.js'
import { ContainerBlock } from '../atoms/blocks/layout/container/component.js'
import { GridBlock } from '../atoms/blocks/layout/grid/component.js'
import { NavbarBlock } from '../atoms/blocks/layout/navbar/component.js'
import { SectionBlock } from '../atoms/blocks/layout/section/component.js'
import { SplitViewBlock } from '../atoms/blocks/layout/split-view/component.js'
import { ImageBlock } from '../atoms/blocks/media/image/component.js'
import { DrawerBlock } from '../atoms/blocks/overlay/drawer/component.js'
import { ModalBlock } from '../atoms/blocks/overlay/modal/component.js'
import { PopoverBlock } from '../atoms/blocks/overlay/popover/component.js'
import { TooltipBlock } from '../atoms/blocks/overlay/tooltip/component.js'
import { AlertBlock } from '../atoms/blocks/text/alert/component.js'
import { CodeBlock } from '../atoms/blocks/text/code/component.js'
import { HeadingBlock } from '../atoms/blocks/text/heading/component.js'
import { ProseBlock } from '../atoms/blocks/text/prose/component.js'
import { TextBlock } from '../atoms/blocks/text/text/component.js'

if (typeof window.matchMedia !== 'function') {
  window.matchMedia = ((q: string) => ({ matches: false, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false })) as never
}

describe('foundation blocks and props of the wrong type', () => {
  it('no block throws when a prop arrives as another JSON type (an unresolved binding, a wrong field)', () => {
    const crashes = sweepWrongTypes([
      { type: 'accordion', component: AccordionBlock },
      { type: 'card', component: CardBlock },
      { type: 'tabs', component: TabsBlock },
      { type: 'avatar', component: AvatarBlock },
      { type: 'badge', component: BadgeBlock },
      { type: 'breadcrumb', component: BreadcrumbBlock },
      { type: 'button', component: ButtonBlock },
      { type: 'chip', component: ChipBlock },
      { type: 'copy-button', component: CopyButtonBlock },
      { type: 'divider', component: DividerBlock },
      { type: 'dropdown', component: DropdownBlock },
      { type: 'icon', component: IconBlock },
      { type: 'link', component: LinkBlock },
      { type: 'pagination', component: PaginationBlock },
      { type: 'list', component: ListBlock },
      { type: 'money', component: MoneyBlock },
      { type: 'progress', component: ProgressBlock },
      { type: 'repeater', component: RepeaterBlock },
      { type: 'skeleton', component: SkeletonBlock },
      { type: 'table', component: TableBlock },
      { type: 'radial-progress', component: RadialProgressBlock },
      { type: 'spinner', component: SpinnerBlock },
      { type: 'toast', component: ToastBlock },
      { type: 'checkbox', component: CheckboxBlock },
      { type: 'date-input', component: DateInputBlock },
      { type: 'form', component: FormBlock },
      { type: 'input', component: InputBlock },
      { type: 'number-stepper', component: NumberStepperBlock },
      { type: 'otp-input', component: OtpInputBlock },
      { type: 'radio', component: RadioBlock },
      { type: 'segmented-control', component: SegmentedControlBlock },
      { type: 'select', component: SelectBlock },
      { type: 'textarea', component: TextareaBlock },
      { type: 'toggle', component: ToggleBlock },
      { type: 'announcement-bar', component: AnnouncementBarBlock },
      { type: 'app-rail', component: AppRailBlock },
      { type: 'bottom-bar', component: BottomBarBlock },
      { type: 'container', component: ContainerBlock },
      { type: 'grid', component: GridBlock },
      { type: 'navbar', component: NavbarBlock },
      { type: 'section', component: SectionBlock },
      { type: 'split-view', component: SplitViewBlock },
      { type: 'image', component: ImageBlock },
      { type: 'drawer', component: DrawerBlock },
      { type: 'modal', component: ModalBlock },
      { type: 'popover', component: PopoverBlock },
      { type: 'tooltip', component: TooltipBlock },
      { type: 'alert', component: AlertBlock },
      { type: 'code', component: CodeBlock },
      { type: 'heading', component: HeadingBlock },
      { type: 'prose', component: ProseBlock },
      { type: 'text', component: TextBlock },
    ])
    expect(crashes.join(String.fromCharCode(10))).toBe('')
  }, 120_000)
})
