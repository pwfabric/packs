/**
 * THE TEST APP'S WORDS.
 *
 * A block draws no visitor word of its own: it reads each one from the app's
 * `messages` (`useAppMessage`, `messageOf`), and an app that leaves one out
 * gets nothing. A behaviour test renders a block with no app around it, so
 * this setup stands in for an app: outside an `AppMessagesContext` provider
 * the blocks read these words. A test that puts its own provider around a
 * block (even an empty map) sees exactly that map — that is how a test checks
 * a missing word stays missing.
 */
import { vi } from 'vitest'

export const TEST_APP_WORDS: Readonly<Record<string, string>> = {
  'ui.account.menu': '{name} — account menu',
  'ui.account.name': 'Account',
  'ui.account.profile': 'Profile',
  'ui.account.signIn': 'Sign in',
  'ui.account.signOut': 'Sign out',
  'ui.announcement': 'Announcement',
  'ui.announcement.dismiss': 'Dismiss announcement',
  'ui.avatar.user': 'User',
  'ui.breadcrumb': 'Breadcrumb',
  'ui.carousel.next': 'Next slide',
  'ui.carousel.previous': 'Previous slide',
  'ui.close': 'Close',
  'ui.commandPalette.label': 'Command palette',
  'ui.commandPalette.list': 'Commands',
  'ui.commandPalette.search': 'Search commands',
  'ui.copied': 'Copied',
  'ui.copy': 'Copy',
  'ui.date.nextMonth': 'Next month',
  'ui.date.placeholder': 'Pick a date…',
  'ui.date.previousMonth': 'Previous month',
  'ui.date.unavailable': '{day} is not available — pick another day.',
  'ui.dismiss': 'Dismiss',
  'ui.form.badInput': 'Enter a value this field can take.',
  'ui.form.checkbox': 'Tick this box to go on.',
  'ui.form.code': '{label}: enter all {n} characters',
  'ui.form.email': 'Enter an e-mail address.',
  'ui.form.hidden': '{label}: {message}',
  'ui.form.max': 'Enter {max} or less.',
  'ui.form.maxLength': 'Use at most {maxLength} characters.',
  'ui.form.min': 'Enter {min} or more.',
  'ui.form.minLength': 'Use at least {minLength} characters.',
  'ui.form.pattern': 'Use the format asked for.',
  'ui.form.required': 'Fill in this field.',
  'ui.form.select': 'Choose one of the options.',
  'ui.form.step': 'Enter a value in steps of {step}.',
  'ui.form.tags': '{label}: add at least one',
  'ui.form.type': 'Enter a value of the right kind.',
  'ui.form.url': 'Enter a web address.',
  'ui.gallery.close': 'Close picture',
  'ui.gallery.enlarge': 'Enlarge: {name}',
  'ui.loading': 'Loading',
  'ui.map.highlighted': '{map}; {place} is highlighted',
  'ui.map.locations': 'Locations',
  'ui.menu.close': 'Close menu',
  'ui.menu.open': 'Open menu',
  'ui.nav.bottom': 'Bottom navigation',
  'ui.nav.main': 'Main',
  'ui.nav.rail': 'Application navigation',
  'ui.otp.cell': '{label} digit {n}',
  'ui.pagination.first': 'First page',
  'ui.pagination.label': 'Pagination',
  'ui.pagination.last': 'Last page',
  'ui.pagination.next': 'Next page',
  'ui.pagination.previous': 'Previous page',
  'ui.progress': 'Progress',
  'ui.remove': 'Remove {name}',
  'ui.stepper.decrease': 'Decrease',
  'ui.stepper.increase': 'Increase',
  'ui.table.filter': 'Filter…',
  'ui.table.newTab': 'opens in a new tab',
  'ui.table.select': 'Select',
  'ui.table.selectAll': 'Select all rows',
  'ui.table.selectRow': 'Select row {n}',
  'ui.tree.collapse': 'Collapse {label}',
  'ui.tree.expand': 'Expand {label}',
}

vi.mock('@pwfabric/runtime', async (importOriginal) => {
  const runtime = await importOriginal<typeof import('@pwfabric/runtime')>()
  const useAppMessages = (): Readonly<Record<string, string>> => runtime.useAppMessages() ?? TEST_APP_WORDS
  return {
    ...runtime,
    useAppMessages,
    useAppMessage: (id: string, fallback: string, vars?: Record<string, string | number>) =>
      runtime.messageOf(useAppMessages(), id, fallback, vars as never),
  }
})
