/*
 * Copyright 2013-2014 Samsung Information Systems America, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Author: Koushik Sen

if (typeof J$ === 'undefined') {
    J$ = {};
}

(function (sandbox) {

    require('../iidToLocation');
    var iidToLocation = sandbox.iidToLocation;

    var hash = Object.create(null);
    var frame = Object.create(null);

    var frameStack = [frame];
    var evalFrames = [];
    var smemory = {
        getShadowObject: function(iid) {
            var tmp;
            if(!(tmp = hash[iid])) {
                tmp = Object.create(null);
                hash[iid] = tmp;
            }
            return tmp;
        },

        declare: function(name) {
            frame[name] = undefined;
        },

        getCurrentFrame: function () {
            return frame;
        }
     };

    function ExecutionIndex() {
        var counters = {};
        var countersStack = [counters];

        function executionIndexCall() {
            counters = {};
            countersStack.push(counters);
        }

        function executionIndexReturn() {
            countersStack.pop();
            counters = countersStack[countersStack.length - 1];
        }

        function executionIndexInc(iid) {
            var c = counters[iid];
            if (c === undefined) {
                c = 1;
            } else {
                c++;
            }
            counters[iid] = c;
            counters.iid = iid;
            counters.count = c;
        }

        function executionIndexGetIndex() {
            var i, ret = [];
            var iid;
            for (i = 0; i < countersStack.length; i++) {
                iid = countersStack[i].iid;
                if (iid !== undefined) {
                    ret.push({iid:iid, count:countersStack[i].count});
                }
            }
            return ret;
        }

        if (this instanceof ExecutionIndex) {
            this.executionIndexCall = executionIndexCall;
            this.executionIndexReturn = executionIndexReturn;
            this.executionIndexInc = executionIndexInc;
            this.executionIndexGetIndex = executionIndexGetIndex;
        } else {
            return new ExecutionIndex();
        }
    }


    function ObjectIndex() {

        var executionIndex = new ExecutionIndex();
        var sort = Array.prototype.sort;
        var objectCount = 1;

        var info = {};

        function printInfo(info, tab) {
            for (var iid in info) {
                // TODO need to refactor the following check
                if (info.hasOwnProperty(iid) && iid !== 'count' && iid !== 'total' && iid !== 'isFrame' && iid !== 'lastObjectIdAllocated' &&
                    iid !== 'nonEscaping' && iid !== 'oneActive' && iid !== 'accessedByParentOnly' && iid !== 'pointedBy' && iid !== 'isFrame') {
                    console.log(tab + info[iid].count + " object(s) escaped to the function containing line " + iidToLocation(iid)+" and did not escape to its caller");
                    printInfo(info[iid], tab + "    ");
                }
            }
        }

        function addCount(index, i, isInit, isFrame, objectId) {
            var tmp = info;
            for (var j = index.length - 1; j >= i; j--) {
                var iid = index[j].iid;
                if (!tmp[iid]) {
                    tmp[iid] = {count:0, total:0};
                }
                tmp = tmp[iid];
            }
            tmp.count++;
            if (isInit) {
                tmp.total++;
                tmp.lastObjectIdAllocated = objectId;
                tmp.nonEscaping = true;
                tmp.oneActive = true;
                tmp.accessedByParentOnly = true;
                tmp.pointedBy = false;// can also be another iid or true;
                tmp.isFrame = !!isFrame;
            }
        }

        function subtractCount(index, i) {
            var tmp = info;
            for (var j = index.length - 1; j >= i; j--) {
                var iid = index[j].iid;
                if (!tmp[iid]) {
                    tmp[iid] = {count:0};
                }
                tmp = tmp[iid];
            }
            tmp.count--;
        }

        function indexOfDeviation(creationIndex, accessIndex) {
            var i, len = creationIndex.length;
            for (i = 0; i < len; i++) {
                if (creationIndex[i].iid !== accessIndex[i].iid || creationIndex[i].count !== accessIndex[i].count) {
                    return i;
                }
            }
            return i;
        }

        function hasSameContext(index1, index2) {
            var i, len1 = index1.length, len2 = index2.length;
            if (len1 !== len2) {
                return false;
            }
            for (i = 0; i < len1; i++) {
                if (index1[i].count !== index2[i].count || index1[i].iid !== index2[i].iid) {
                    if (len1 - 1 === i && index1[i].count === index2[i].count) {
                        return true;
                    }
                    return false;
                }
            }
            return true;
        }


        function putField(base, val) {
            var sobjBase = smemory.getShadowObject(base);
            var sobjVal = smemory.getShadowObject(val);
            var infoObj;

            if (sobjVal && sobjVal.creationIndex) {
                infoObj = info[getAllocIID(sobjVal.creationIndex)];
                if (sobjBase && sobjBase.creationIndex) {
                    var baseIID = getAllocIID(sobjBase.creationIndex);
                    if (hasSameContext(sobjBase.creationIndex, sobjVal.creationIndex)) {
                        if (infoObj.pointedBy === false) {
                            infoObj.pointedBy = baseIID;
                        } else if (infoObj.pointedBy !== true && infoObj.pointedBy !== baseIID) {
                            infoObj.pointedBy = true;
                        }
                    } else {
                        infoObj.pointedBy = true;
                    }
                } else {
                    infoObj.pointedBy = true;
                }
            }
        }

        function simulatePutField(val) {
            if (typeof val === 'object') {
                for (var offset in val) {
                    if (val.hasOwnProperty(offset)) {
                        putField(val, val[offset]);
                    }
                }
            }
        }

        function annotateObject(iid, obj, isFrame) {
            var sobj = smemory.getShadowObject(obj);

            if (sobj) {
                executionIndex.executionIndexInc(iid);
                if (sobj.creationIndex === undefined) {
                    sobj.creationIndex = executionIndex.executionIndexGetIndex();
                    sobj.i = sobj.creationIndex.length - 1;
                    sobj.objectId = objectCount++;
                    addCount(sobj.creationIndex, sobj.i, true, isFrame, sobj.objectId);
                }
            }
        }

        function getAllocIID(creationIndex) {
            return creationIndex[creationIndex.length - 1].iid;
        }

        function accessObject(obj) {
            var sobj = smemory.getShadowObject(obj);
            var infoObj;

            if (sobj && sobj.creationIndex) {
                executionIndex.executionIndexInc(0);
                var accessIndex = executionIndex.executionIndexGetIndex();
                var newi = indexOfDeviation(sobj.creationIndex, accessIndex);
                infoObj = info[getAllocIID(sobj.creationIndex)];
                if (newi < sobj.i) {
                    infoObj.nonEscaping = false;
                }
                if (infoObj.lastObjectIdAllocated !== sobj.objectId) {
                    infoObj.oneActive = false;
                }
                if (newi < sobj.i) {
                    subtractCount(sobj.creationIndex, sobj.i);
                    addCount(sobj.creationIndex, newi);
                    sobj.i = newi;
                }
                if (newi !== sobj.creationIndex.length - 1 && newi !== accessIndex.length - 1) {
                    infoObj.accessedByParentOnly = false;
                }
            }
        }


        this.createObject = function (iid, val) {
            annotateObject(iid, val, false);
        };

        this.accessObject = function (base) {
            accessObject(base);
        };

        this.putField = function (base, val) {
            putField(base, val);
        };


        this.endExecution = function () {
            var tmp = [];
            for (var iid in info) {
                if (info.hasOwnProperty(iid)) {
                    tmp.push({iid:iid, count:info[iid].total});
                }
            }
            sort.call(tmp, function (a, b) {
                return b.count - a.count;
            });
            for (var x in tmp) {
                if (tmp.hasOwnProperty(x)) {
                    var iid = tmp[x].iid;
                    console.log(info[iid].total + " "+(info[iid].isFrame ? "call frame(s)" : "object(s)/function(s)/array(s)") + " got allocated at " + iidToLocation(iid) +
                        " of which " + info[iid].count + " object(s) did not escape to its caller" +
                        (info[iid].oneActive ? "\n    and has one at most one active object at a time" : "") +
                        (info[iid].nonEscaping ? "\n    and does not escape its caller" : "") +
//                        ((info[iid].oneActive && info[iid].accessedByParentOnly && !info[iid].nonEscaping) ? "\n    and is used by its parents only" : "") +
                        ((typeof info[iid].pointedBy !== 'boolean') ? "\n    and is uniquely pointed by objects allocated at " + iidToLocation(info[iid].pointedBy) : ""));
                    if (printEscapeTree) printInfo(info[iid], "    ");
                }
            }

//            printInfo(info, "");
//            console.log(JSON.stringify(info));
        };
//
        this.functionEnter = function (iid) {
            executionIndex.executionIndexInc(iid);
            executionIndex.executionIndexCall();
        };

        this.functionExit = function () {
            executionIndex.executionIndexReturn();
        };
    }

    var oindex = sandbox.analysis = new ObjectIndex();
    var printEscapeTree;
    var FileLineReader = require('../utils/FileLineReader');
    var args = process.argv.slice(2);
    var traceFh = new FileLineReader(args[0]);
    printEscapeTree = args[1];
    while (traceFh.hasNextLine()) {
        var line = traceFh.nextLine();
        var record = JSON.parse(line);
        switch(record[0]) {
            case 0:
// DECLARE, // fields: iid, name, obj-id
                break;
            case 1:
                oindex.createObject(record[1], record[2]);
// CREATE_OBJ, // fields: iid, obj-id
                break;
            case 2:
//                oindex.createObject(record[1], record[3]);
// CREATE_FUN, // fields: iid, function-enter-iid, obj-id.  NOTE: proto-obj-id is always obj-id + 1
                break;
            case 3:
                oindex.putField(record[2], record[4]);
// PUTFIELD, // fields: iid, base-obj-id, prop-name, val-obj-id
                break;
            case 4:
                oindex.putField(0, record[3]);
// WRITE, // fields: iid, name, obj-id
                break;
            case 5:
                oindex.accessObject(record[1]);
// LAST_USE, // fields: obj-id, timestamp, iid
                break;
            case 6:
                oindex.functionEnter(record[1]);
// FUNCTION_ENTER, // fields: iid, function-object-id
                break;
            case 7:
                oindex.functionExit();
// FUNCTION_EXIT, // fields: iid
                break;
            case 8:
// TOP_LEVEL_FLUSH,  // fields: iid
                break;
            case 9:
// UPDATE_IID, // fields: obj-id, new-iid
                break;
            case 10:
// DEBUG, // fields: call-iid, obj-id
                break;
            case 11:
// RETURN, // fields: obj-id
                break;
            case 12:
//  CREATE_DOM_NODE, // fields: iid (or -1 for unknown), obj-id
                break;
            case 13:
// ADD_DOM_CHILD, // fields: parent-obj-id, child-obj-id
                break;
            case 14:
// REMOVE_DOM_CHILD, // fields: parent-obj-id, child-obj-id
                break;
            case 15:
// ADD_TO_CHILD_SET, // fields: iid, parent-obj-id, name, child-obj-id
                break;
            case 16:
// REMOVE_FROM_CHILD_SET, // fields: iid, parent-obj-id, name, child-obj-id
                break;
            case 17:
// DOM_ROOT, // fields: obj-id
                break;
            case 18:
                oindex.accessObject(record[2]);
// UNREACHABLE // fields: iid, obj-id
                break;
        }
    }
    oindex.endExecution();

}(J$));

// node src/js/commands/mem.js tests/oindex-koushik/oindex1.trace