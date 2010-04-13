if (!window.ace)
    ace = {};

ace.TextDocument = function(text) {
    this.lines = this._split(text);
    this.modified = true;

    this.listeners = [];
};

ace.TextDocument.prototype._split = function(text) {
    return text.split(/[\n\r]/);
};

ace.TextDocument.prototype.toString = function() {
    return this.lines.join("\n");
};

ace.TextDocument.prototype.addChangeListener = function(listener) {
    this.listeners.push(listener);
};

ace.TextDocument.prototype.fireChangeEvent = function(firstRow, lastRow) {
    for ( var i = 0; i < this.listeners.length; i++) {
        this.listeners[i](firstRow, lastRow);
    };
};

ace.TextDocument.prototype.getWidth = function() {
    if (this.modified) {
        this.modified = false;

        var lines = this.lines;
        var longestLine = 0;
        for ( var i = 0; i < lines.length; i++) {
            longestLine = Math.max(longestLine, lines[i].length);
        }
        this.width = longestLine;
    }
    return this.width;
};

ace.TextDocument.prototype.getLine = function(row) {
    return this.lines[row] || "";
};

ace.TextDocument.prototype.keywords = {
    "break" : 1,
    "case" : 1,
    "catch" : 1,
    "continue" : 1,
    "default" : 1,
    "delete" : 1,
    "do" : 1,
    "else" : 1,
    "finally" : 1,
    "for" : 1,
    "function" : 1,
    "if" : 1,
    "in" : 1,
    "instanceof" : 1,
    "new" : 1,
    "return" : 1,
    "switch" : 1,
    "throw" : 1,
    "try" : 1,
    "typeof" : 1,
    "var" : 1,
    "while" : 1,
    "with" : 1
};

ace.TextDocument.prototype.getLength = function() {
    return this.lines.length;
};

ace.TextDocument.prototype.getTextRange = function(range) {
    if (range.start.row == range.end.row) {
        return this.lines[range.start.row].substring(range.start.column,
                                                     range.end.column);
    }
    else {
        var lines = [];
        lines.push(this.lines[range.start.row].substring(range.start.column));
        lines.push.apply(lines, this.lines.slice(range.start.row + 1,
                                                 range.end.row));
        lines.push(this.lines[range.end.row].substring(0, range.end.column));

        return lines.join("\n");
    }
};

ace.TextDocument.prototype.findMatchingBracket = function(position) {
    if (position.column == 0) return null;

    var charBeforeCursor = this.getLine(position.row).charAt(position.column-1);
    if (charBeforeCursor == "") return null;

    var match = charBeforeCursor.match(/([\(\[\{])|([\)\]\}])/);
    if (!match) {
        return null;
    }

    if (match[1]) {
        return this._findClosingBracket(match[1], position);
    } else {
        return this._findOpeningBracket(match[2], position);
    }
};

ace.TextDocument.prototype._brackets = {
    ")": "(",
    "(": ")",
    "]": "[",
    "[": "]",
    "{": "}",
    "}": "{"
};

ace.TextDocument.prototype._findOpeningBracket = function(bracket, position) {
    var openBracket = this._brackets[bracket];

    var column = position.column - 2;
    var row = position.row;
    var depth = 1;

    var line = this.getLine(row);

    while (true) {
        while(column >= 0) {
            var char = line.charAt(column);
            if (char == openBracket) {
                depth -= 1;
                if (depth == 0) {
                    return {row: row, column: column};
                }
            }
            else if (char == bracket) {
                depth +=1;
            }
            column -= 1;
        }
        row -=1;
        if (row < 0) break;

        var line = this.getLine(row);
        var column = line.length-1;
    }
    return null;
};

ace.TextDocument.prototype._findClosingBracket = function(bracket, position) {
    var closingBracket = this._brackets[bracket];

    var column = position.column;
    var row = position.row;
    var depth = 1;

    var line = this.getLine(row);
    var lineCount = this.getLength();

    while (true) {
        while(column < line.length) {
            var char = line.charAt(column);
            if (char == closingBracket) {
                depth -= 1;
                if (depth == 0) {
                    return {row: row, column: column};
                }
            }
            else if (char == bracket) {
                depth +=1;
            }
            column += 1;
        }
        row +=1;
        if (row >= lineCount) break;

        var line = this.getLine(row);
        var column = 0;
    }
    return null;
};

ace.TextDocument.prototype.insert = function(position, text) {
    var end = this._insert(position, text);
    this.fireChangeEvent(position.row, position.row == end.row ? position.row
            : undefined);
    return end;
};

ace.TextDocument.prototype._insert = function(position, text) {
    this.modified = true;

    var newLines = this._split(text);

    if (text == "\n") {
        var line = this.lines[position.row] || "";
        this.lines[position.row] = line.substring(0, position.column);
        this.lines.splice(position.row + 1, 0, line.substring(position.column));

        return {
            row : position.row + 1,
            column : 0
        };
    }
    else if (newLines.length == 1) {
        var line = this.lines[position.row] || "";
        this.lines[position.row] = line.substring(0, position.column) + text
                + line.substring(position.column);

        return {
            row : position.row,
            column : position.column + text.length
        };
    }
    else {
        var line = this.lines[position.row] || "";

        this.lines[position.row] = line.substring(0, position.column)
                + newLines[0];
        this.lines[position.row + 1] = newLines[newLines.length - 1]
                + line.substring(position.column);

        if (newLines.length > 2) {
            var args = [ position.row + 1, 0 ];
            args.push.apply(args, newLines.slice(1, -1));
            this.lines.splice.apply(this.lines, args);
        }

        return {
            row : position.row + newLines.length - 1,
            column : newLines[newLines.length - 1].length
        };
    }
};

ace.TextDocument.prototype.remove = function(range) {
    this._remove(range);

    this.fireChangeEvent(range.start.row,
                         range.end.row == range.start.row ? range.start.row
                                 : undefined);
    return range.start;
};

ace.TextDocument.prototype._remove = function(range) {
    this.modified = true;

    var firstRow = range.start.row;
    var lastRow = range.end.row;

    var row = this.lines[firstRow].substring(0, range.start.column)
            + this.lines[lastRow].substring(range.end.column);

    this.lines.splice(firstRow, lastRow - firstRow + 1, row);

    return range.start;
};

ace.TextDocument.prototype.replace = function(range, text) {
    this._remove(range);
    if (text) {
        var end = this._insert(range.start, text);
    }
    else {
        end = range.start;
    }

    var lastRemoved = range.end.column == 0 ? range.end.column - 1
            : range.end.column;
    this.fireChangeEvent(range.start.row, lastRemoved == end.row ? lastRemoved
            : undefined);

    return end;
};

ace.TextDocument.prototype.indentRows = function(range, indentString) {
  for (var i=range.start.row; i<= range.end.row; i++) {
      this.lines[i] = indentString + this.getLine(i);
  }
  this.fireChangeEvent(range.start.row, range.end.row);
};

ace.TextDocument.prototype.outdentRows = function(range, indentString) {
    outdentLength = indentString.length;

    for (var i=range.start.row; i<= range.end.row; i++) {
        if (this.getLine(i).substr(0, outdentLength) !== indentString) {
            return 0;
        }
    }

    for (var i=range.start.row; i<= range.end.row; i++) {
        this.lines[i] = this.getLine(i).substring(outdentLength);
    }

    this.fireChangeEvent(range.start.row, range.end.row);
    return outdentLength;
};