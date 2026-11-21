import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

export function credentialsFile(contents: string): string {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tb-nw-')), '.testingbot')
  fs.writeFileSync(file, contents)
  return file
}
