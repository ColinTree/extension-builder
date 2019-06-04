# extension-builder

This is a cloud build system of app inventor extensions

* [Formal server](http://bot.colintree.cn:8048)
* [Dev server](http://bot.colintree.cn:8049)

[Github source](https://github.com/ColinTree/extension-builder)

## How to use

To make extensions enable to be recognised by this service, add `builder-config.json` in the same directory of your extension java file.

`builder-config.json` Accepts:

```
{
  "package": "FILL IN THE SAME PACKAGE OF YOUR EXTENSION(S)"
}
```

Sample config: https://github.com/OpenSourceAIX/ColinTreeListView/blob/master/builder-config.json