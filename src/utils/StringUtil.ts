export class StringUtil {

  public static readonly MULTI_LINE_COMMENT_REGEXP = /^(\/\*[^*]*\*+(?:[^/*][^*]*\*+)*\/\s*)*/;
  public static readonly SINGLE_LINE_COMMENT_REGEXP = /^(\/\/[^\n]*\s*)*/
  public static trimLeftComments (content: string) {
    let match: RegExpMatchArray;
    while (true) {
      // multi-line comments
      match = content.match(StringUtil.MULTI_LINE_COMMENT_REGEXP);
      if (match.length > 0 && match[0].length > 0) {
        content = content.substr(match[0].length);
        continue;
      }
      // single line comments
      match = content.match(StringUtil.SINGLE_LINE_COMMENT_REGEXP);
      if (match.length > 0 && match[0].length > 0) {
        content = content.substr(match[0].length);
        continue;
      }
      break;
    }
    return content;
  }
}