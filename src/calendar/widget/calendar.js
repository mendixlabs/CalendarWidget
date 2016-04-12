/*jslint white:true, nomen: true, plusplus: true */
/*global mx, define, require, browser, devel, console, setTimeout, logger */
/*mendix */

//logger.level(logger.DEBUG);

define([
    "dojo/_base/declare", "mxui/widget/_WidgetBase",
    "mxui/dom", "dojo/dom", "dojo/query", "dojo/dom-prop", "dojo/dom-geometry", "dojo/dom-class", "dojo/dom-style", "dojo/dom-construct", "dojo/_base/array", "dojo/_base/lang",
    "calendar/lib/jquery-2.1.3.min", "calendar/lib/moment", "calendar/lib/fullcalendar" , "calendar/lib/lang-all"
], function (declare, _WidgetBase, dom, dojoDom, domQuery, domProp, domGeom, domClass, domStyle, domConstruct, dojoArray, lang, _jQuery, moment, fullCalendar, calendarLang) {
    "use strict";

    var $ = _jQuery.noConflict(true);

    return declare("calendar.widget.calendar", [_WidgetBase], {
        _mxObj: null,
        _calendarBox: null,
        _handles: null,
        _header: null,
        _buttonText: null,
        _hasStarted: null,
        _eventIsClicked: false,
        _views  : null,
        _titleFormat: null,
        _dateFormat: null,
        _timeFormat: null,
        _colors: null,
        _eventSource: null,
        _fcNode: null,
        _availableViews: null,
        _allowCreate: true,
        _shouldDestroyOnUpdate: false,
        _triggeredRenderAll: false,

        postCreate: function () {
            //logger.level(logger.DEBUG);
            logger.debug(this.id + ".postCreate");
            this._colors = this.notused; //workaround for legacy users
            this._availableViews = this.notused1; //workaround for legacy users
            this._setDefaults(); //set default formatting options
            this._handles = [];
            this._eventSource = [];
            this._allowCreate = this.editable || (this.neweventmf !== null && this.neweventmf !== "");
            this._shouldDestroyOnUpdate = this._hasDynamicCalendarPropertiesConfigured();
        },

        startup: function () {
            logger.debug(this.id + ".startup");
            if(this._hasStarted) {
                return;
            }
            this._hasStarted = true;

            //make a calendarbox
            this._calendarBox = dom.create("div", {
                "id": "calendar_" + this.id
            });
            domConstruct.place(this._calendarBox, this.domNode);

            this._fcNode = $(this._calendarBox);

            this._renderCalendar(null);
        },

        update: function (obj, callback) {
            logger.debug(this.id + ".update");
            if (this._handles && this._handles.length && this._handles.length > 0) {
                dojoArray.forEach(this._handles, function (handle) {
                    mx.data.unsubscribe(handle);
                });
            }
            this._handles = [];

            this._mxObj = obj;
            this._fetchObjects();
            this._renderCalendar();

            //subscribe to changes in the event entity and context object(if applicable).
            this._addSubscriptions();

            if (typeof callback !== "undefined") {
                callback();
            }
        },

        resize: function () {
            logger.debug(this.id + ".resize");
            this._fcNode.fullCalendar("render");
        },

        _addSubscriptions: function () {
            logger.debug(this.id + "._addSubscriptions");
            var subscription = mx.data.subscribe({
                    entity: this.eventEntity,
                    callback: lang.hitch(this, function (entity) {
                        //we re-fetch the objects, and refresh them on the calendar
                        this._fetchObjects();
                    })
                }),
                contextSubscription = null,
                contextStartPosAttributeSubscription = null,
                contextFirstDayAttributeAttributeSubscription = null;

            this._handles.push(subscription);

            if (this._mxObj){
                contextSubscription = mx.data.subscribe({
                    guid: this._mxObj.getGuid(),
                    callback: lang.hitch(this, function (guid) {
                        this._fetchObjects();
                    })
                });
                this._handles.push(contextSubscription);

                if(this.startPos) {
                    contextStartPosAttributeSubscription = mx.data.subscribe({
                        guid: this._mxObj.getGuid(),
                        attr: this.startPos,

                        callback: lang.hitch(this, function (guid) {
                            this._renderCalendar();
                        })
                    });
                    this._handles.push(contextStartPosAttributeSubscription);
                }
                if(this.firstdayAttribute) {
                    contextFirstDayAttributeAttributeSubscription = mx.data.subscribe({
                        guid: this._mxObj.getGuid(),
                        attr: this.firstdayAttribute,

                        callback: lang.hitch(this, function (guid) {
                            this._renderCalendar();
                        })
                    });
                    this._handles.push(contextFirstDayAttributeAttributeSubscription);
                }
                this._onEventAfterAllRender();
            }

        },

        _fetchObjects: function () {
            logger.debug(this.id + "._fetchObjects");
            var constraint = null,
                expectObj = null,
                xpath = null,
                errordiv = null;

            if (this.dataSourceType === "xpath") {
                logger.debug(this.id + "._fetchObjects xpath");
                constraint = this.eventConstraint;
                expectObj = this.eventConstraint.indexOf("[%CurrentObject%]") >= 0;

                if (this._mxObj && expectObj) {
                    constraint = this.eventConstraint.replace(/\[%CurrentObject%\]/gi, this._mxObj.getGuid());
                } else if (expectObj) {
                    this._clearCalendar();
                    return;
                }

                xpath = "//" + this.eventEntity + constraint;
                mx.data.get({
                    xpath: xpath,
                    callback: lang.hitch(this, this._prepareEvents)
                }, this);
            } else if (this.dataSourceType === "contextmf_viewspecific" && this.contextDatasourceMf) {
                logger.debug(this.id + "._fetchObjects contextmf_viewspecific");
                if (this._mxObj && this.viewContextReference) {
                    var view = this._fcNode.fullCalendar("getView");
                    this._fetchPaginatedEvents(view.start, view.end);
                }
            } else if (this.dataSourceType === "contextmf" && this.contextDatasourceMf) {
                logger.debug(this.id + "._fetchObjects contextmf", this._mxObj);
                if (this._mxObj) {
                    this._execMF(this._mxObj, this.contextDatasourceMf, lang.hitch(this, this._prepareEvents));
                }
            } else if (this.dataSourceType === "mf" && this.datasourceMf) {
                logger.debug(this.id + "._fetchObjects mf");
                this._execMF(null, this.datasourceMf, lang.hitch(this, this._prepareEvents));
            } else {

                domConstruct.empty(this.domNode);
                if (this.dataSourceType === "contextmf") {
                    errordiv = dom.div("Data source type 'Microflow with context object' is selected, but no microflow was specified for property 'Dataview data source microflow'");
                } else if (this.dataSourceType === "mf") {
                    errordiv = dom.div("Data source type 'Microflow' is selected, but no microflow was specified for property 'Data source microflow'");
                } else if (this.dataSourceType === "contextmf_viewspecific") {
                    errordiv = dom.div("Data source type 'Microflow with context object (Retrieve events for each view)' is selected, but no microflow was specified for property 'Dataview data source microflow'");
                }

                domStyle.set(errordiv, {
                    "border": "1px solid red",
                    "color": "red",
                    "padding": "5px"
                });
                this.domNode.appendChild(errordiv);
            }
        },

        _clearCalendar: function () {
            logger.debug(this.id + "._clearCalendar");
            if (this._fcNode) {
                this._fcNode.fullCalendar("removeEvents");
            }
        },

        _prepareEvents: function (objs) {
            logger.debug(this.id + "._prepareEvents");
            var objTitles = null,
                objRefs = null,
                refTitles = null,
                split = null,
                thisRef = null;

            objTitles = {};
            objRefs = [];
            refTitles = {};
            split = this.titleAttr.split("/");
            thisRef = null;

            if (typeof objs === "undefined" || objs === "" || objs.length === 0) {
                return;
            }

            if (split.length === 1) {
                // titleAttr is a simple attribute and the key of objTitles is
                // the GUID of the object and the title is the attribute.
                $.each(objs, lang.hitch(this, function (index, obj) {
                    objTitles[obj.getGuid()] = obj.get(this.titleAttr);
                }));
                this._createEvents(objs, objTitles);
            } else if (split.length === 3) {

                // titleAttr is a reference and we have more work to do.
                $.each(objs, function (index, obj) {
                    thisRef = obj.get(split[0]);
                    objTitles[obj.getGuid()] = thisRef;
                    // objRefs should only contain the unique list of referred objects.
                    if (objRefs.indexOf(thisRef) < 0) {
                        objRefs.push(thisRef);
                    }
                });
                // Now get the actual title strings from the list of referred objects ...
                // This is an asynchronous call.
                mx.data.get({
                    guids: objRefs,
                    nocache: false,
                    callback: function (refObjs) {
                        var i = null,
                            thisValue = null;

                        // Get the title string for each referenced object and store it
                        // as the value in the refTitles array.
                        for (i = 0; i < refObjs.length; i++) {
                            refTitles[refObjs[i].getGuid()] = refObjs[i].get(split[2]);
                        }
                        // Now, loop through the objTitles array and replace the value (which is
                        // is the GUID of the referred object) with the actual title string extracted
                        // from the referred object.
                        $.each(objTitles, function (index, obj) {
                            if (objTitles.hasOwnProperty(index)) {
                                thisValue = objTitles[index];
                                objTitles[index] = refTitles[objTitles[index]];
                            }
                        });
                        // Now that we finally have all of the referenced titles, we can call
                        // createEvents()
                        this._createEvents(objs, objTitles);

                    }
                }, this);
                //this._createEvents(objs, objTitles);
            } else {
                // this should never happen and is likely an error
                console.error("Error in titleAttr: " + this.titleAttr + ". This should be either a simple attribute or a 1-deep reference.");
            }
        },

        _createEvents: function (objs, titles) {
            logger.debug(this.id + "._createEvents");
            var events = [],
                    objcolors = null;

            $.each(objs, lang.hitch(this, function (index, obj) {
                //get the colors
                if (this._colors.length > 0 && this.typeAttr) {
                    objcolors = this._getObjectColors(obj);
                }
                //get the dates
                var start = new Date(obj.get(this.startAttr)),
                        end = new Date(obj.get(this.endAttr)),
                        //create a new calendar event
                        newEvent = {
                            title: titles[obj.getGuid()],
                            start: start,
                            end: end,
                            allDay: obj.get(this.alldayAttr),
                            editable: this.editable,
                            mxobject: obj //we add the mxobject to be able to handle events with relative ease.
                        };

                if (objcolors) {
                    newEvent.backgroundColor = objcolors.backgroundColor;
                    newEvent.borderColor = objcolors.borderColor;
                    newEvent.textColor = objcolors.textColor;
                }
                events.push(newEvent);
            }));
            //check if the calendar already exists (are we just updating events here?)
            if (this._fcNode.hasClass("fc")) {
                //if it does, remove, add the new source and refetch
                this._fcNode.fullCalendar("render");
                if (this._eventSource && this._eventSource.length >= 1) {
                    this._fcNode.fullCalendar("removeEventSource", this._eventSource);
                }

                this._fcNode.fullCalendar("addEventSource", events);
                this._fcNode.fullCalendar("refetchEvents");
            } else {
                //else create the calendar
                this._renderCalendar(events);
            }
            this._eventSource = events;
        },

        _renderCalendar: function (events) {
            logger.debug(this.id + "._renderCalendar");
            var options = this._setCalendarOptions(events);

            // Only destroy calendar when widget configuration requires full rerendering of calendar.
            if (this._shouldDestroyOnUpdate) {
                this._fcNode.fullCalendar("destroy");
            }

            this._fcNode.fullCalendar(options);

            if (this._mxObj && this._mxObj.get(this.startPos)) {
                this._fcNode.fullCalendar("gotoDate", new Date(this._mxObj.get(this.startPos)));
            }
            else {
                this._fcNode.fullCalendar("gotoDate", new Date());
            }

        },

        _onEventChange: function (event, dayDelta, minuteDelta, allDay, revertFunc) {
            logger.debug(this.id + "._onEventChange", event);
            var obj = event.mxobject;
            this._setVariables(obj, event, this.startAttr, this.endAttr, allDay);
            this._execMF(obj, this.onchangemf);
        },

        _onEventClick: function (event) {
            logger.debug(this.id + "._onEventClick", event);
            var obj = event.mxobject;
            this._setVariables(obj, event, this.startAttr, this.endAttr);
            this._execMF(obj, this.onclickmf);
        },

        _onSelectionMade: function (startDate, endDate, allDay, jsEvent, view) {
            logger.debug(this.id + "._onSelectionMade");
            var eventData = {
                start: startDate,
                end: endDate
            };

            if (!this._eventIsClicked) {
                mx.data.create({
                    entity: this.eventEntity,
                    callback: function (obj) {
                        this._setVariables(obj, eventData, this.startAttr, this.endAttr, allDay);
                        if (this._mxObj && this.neweventref !== "") {
                            obj.addReference(this.neweventref.split("/")[0], this._mxObj.getGuid());
                        }
                        this._execMF(obj, this.neweventmf);
                    },
                    error: function (err) {
                        console.warn("Error creating object: ", err);
                    }
                }, this);

                this._eventIsClicked = true;

                setTimeout(lang.hitch(this, function () {
                    this._eventIsClicked = false;
                }), 1000);
            }
        },

        _getObjectColors: function (obj) {
            logger.debug(this.id + "._getObjectColors");
            var objcolors = null;

            $.each(this._colors, lang.hitch(this, function (index, color) {
                //set color when enum color equals the color we have on file
                if (obj.get(this.typeAttr) === color.enumKey) {
                    objcolors = {
                        backgroundColor: color.bgColor,
                        borderColor: color.border,
                        textColor: color.textColor
                    };

                    //We have found the color so we can stop iterating
                    return false;
                }
            }));

            return objcolors;
        },

        _setVariables: function (obj, event, startAttribute, endAttribute, allDay) {
            logger.debug(this.id + "._setVariables");
            //update the mx object
            obj.set(startAttribute, event.start);
            if (event.end !== null) {
                obj.set(endAttribute, event.end);
            }

            if (allDay !== null) {
                obj.set(this.alldayAttr, allDay);
            }
        },

        _setDefaults: function () {
            logger.debug(this.id + "._setDefaults");
            var views = [];

            this._header = {
                left: "title",
                center: ""
            };

            this._titleFormat = {
                month: "MMMM YYYY", // September 2009
                week: "MMM D YYYY", // Sep 13 2009
                day: "MMMM D YYYY" //  Sep 8, 2009
            };

            if (this.titleFormat) {
                this._titleFormat[""] = this.titleFormat;
            }

            if (this.dateFormat) {
                this._dateFormat = this.dateFormat;
            }

            if (this.timeFormat) {
                this._timeFormat = this.timeFormat;
            }

            this._buttonText = {};

            this._views = {};

            if (this._availableViews.length > 0) {
                //fill default specifics
                $.each(this._availableViews, lang.hitch(this, function (index, view) {
                    var viewName = view.availableViews;
                    views.push(viewName);

                    this._views[viewName] = {};

                    if (view.eventLimit > 0) {
                        this._views[viewName].eventLimit = view.eventLimit;
                    }

                    if (view.titleFormatViews !== "") {
                        this._titleFormat[viewName] = view.titleFormatViews;
                    }
                    if (view.dateFormatViews !== "") {
                        if (typeof this._dateFormat === "undefined" || this._dateFormat === null) {
                            this._dateFormat = {};
                        } else if (typeof this._dateFormat === "string") {
                            this._dateFormat = {};
                            this._dateFormat[""] = this.dateFormat;
                        }

                        this._dateFormat[viewName] = view.dateFormatViews;
                    }
                    if (view.timeFormatViews !== "") {
                        if (typeof this._timeFormat === "undefined" || this._timeFormat === null) {
                            this._timeFormat = {};
                        } else if (typeof this._timeFormat === "string") {
                            this._timeFormat = {};
                            this._timeFormat[""] = this.timeFormat;
                        }
                        this._timeFormat[viewName] = view.timeFormatViews;
                    }

                    if (view.labelViews !== "") {
                        this._buttonText[viewName] = view.labelViews;
                    }
                }));

            }

            if (this.todaycaption) {
                this._buttonText.today = this.todaycaption;
            }

            this._header.right = "today " + views.join() + " prev,next";

            this.monthNamesFormat = this.monthNamesFormat ? this.monthNamesFormat.split(",") : null;
            this.monthShortNamesFormat = this.monthShortNamesFormat ? this.monthShortNamesFormat.split(",") : null;
            this.dayNamesFormat = this.dayNamesFormat ? this.dayNamesFormat.split(",") : null;
            this.dayShortNamesFormat = this.dayShortNamesFormat ? this.dayShortNamesFormat.split(",") : null;
            this.slotMinutes = this.slotMinutes ? this.slotMinutes : "00:30:00";
            this.axisFormat = this.axisFormat ? this.axisFormat : "h(:mm)a";
            this.startTime = this.startTime ? this.startTime : "08:00";
            this.endTime = this.endTime ? this.endTime : "17:00";

        },

        _setCalendarOptions: function (events) {
            logger.debug(this.id + "._setCalendarOptions");
            var options = {
                //contents
                header: this._header,
                events: events,
                //configs
                editable: this._allowCreate, //allows resizing events
                selectable: this._allowCreate, //allows selecting a portion of the day or one or multiple days (based on the view)
                //event handling
                eventResize: lang.hitch(this, this._onEventChange), //is called when an event is dragged and has changed
                eventDrop: lang.hitch(this, this._onEventChange), //is called when an event is dragged and has changed
                eventClick: lang.hitch(this, this._onEventClick), //is called when an event is clicked
                viewRender: lang.hitch(this, this._onViewChange), //is called when the view (start/end on month, week, etc) has changed
                select: lang.hitch(this, this._onSelectionMade), //is called after a selection has been made
                eventAfterAllRender: lang.hitch(this, this._onEventAfterAllRender),
                //appearance
                timezone: "local",
                views : this._views,
                defaultView: this.defaultView,
                firstDay: this.firstday,
                height: this.calHeight===0 ? "auto" : this.calHeight,
                weekNumbers: this.showWeekNumbers,
                weekNumberTitle: this.weeknumberTitle,
                weekends: this.showWeekends,
                slotDuration: this.slotMinutes,
                axisFormat: this.axisFormat,
                buttonText: this._buttonText,
                lang: this.languageSetting,
                eventLimit: this.limitEvents,
                scrollTime: this.scrollTime,
            };

            if (this._titleFormat) {
                options.titleFormat = this._titleFormat;
            }
            if (this._timeFormat) {
                options.timeFormat = this._timeFormat;
            }
            if (this._dateFormat) {
                options.columnFormat = this._dateFormat;
            }
            if (this.monthNamesFormat) {
                options.monthNames = this.monthNamesFormat;
            }
            if (this.monthShortNamesFormat) {
                options.monthNamesShort = this.monthShortNamesFormat;
            }
            if (this.dayNamesFormat) {
                options.dayNames = this.dayNamesFormat;
            }
            if (this.dayShortNamesFormat) {
                options.dayNamesShort = this.dayShortNamesFormat;
            }
            if (this.alldaycaption) {
                options.allDayText = this.alldaycaption;
            }
            if (this.businessHours) {
                options.businessHours = {
                    start: this.startTime,
                    end: this.endTime,
                    dow: [1, 2, 3, 4, 5]
                };
            }

            if(this._mxObj)
            {
                if(this.showWeekendsAttribute){
                    options.weekends = this._mxObj.get(this.showWeekendsAttribute);
                }
                if(this.firstdayAttribute){
                    options.firstDay = this._mxObj.get(this.firstdayAttribute);
                }
            }

            return options;
        },

        _execMF: function (obj, mf, cb) {
            logger.debug(this.id + "._execMF", mf);
            if (mf) {
                var params = {
                    applyto: "selection",
                    actionname: mf,
                    guids: []
                };
                if (obj) {
                    params.guids = [obj.getGuid()];
                }
                logger.debug(this.id + "._execMF params:", params);
                mx.data.action({
                    store: {
                        caller: this.mxform
                    },
                    params: params,
                    callback: lang.hitch(this, function (objs) {
                        logger.debug(this.id + "._execMF callback:", objs ? objs.length + " objects" : "null");
                        if (cb) {
                            cb(objs);
                        }
                    }),
                    error: function (error) {
                        if (cb) {
                            cb();
                        }
                        console.warn(error.description);
                    }
                }, this);

            } else if (cb) {
                cb();
            }
        },

        _onViewChange: function (view, element) {
            logger.debug(this.id + "._onViewChange");
            logger.debug("_onViewChange\nonviewChangeMF: ", this.onviewchangemf, "\nviewContextReference:", this.viewContextReference, "\n_mxObj", this._mxObj);
            var eventData = {
                start: view.start,
                end: view.end
            };

            if (this.onviewchangemf !== "") {
                if (this.viewContextReference !== "" && this._mxObj) {
                    var ref = this.viewContextReference.split("/")[0],
                        refGuid = this._mxObj.getReference(ref);

                    if (refGuid !== "") {
                        mx.data.get({
                            guid: refGuid,
                            callback: lang.hitch(this, function (eventData, viewrenderObj) {

                                this._setVariables(viewrenderObj, eventData, this.viewStartAttr, this.viewEndAttr);
                                this._execMF(this._mxObj, this.onviewchangemf, lang.hitch(this, this._prepareEvents));

                            }, eventData),
                            error: function (err) {
                                console.warn("Error retrieving referenced object: ", err);
                            }
                        });
                    } else {
                        this._createViewChangeEntity(lang.hitch(this, function (eventData, viewrenderObj) {

                            this._mxObj.addReference(ref, viewrenderObj.getGuid());
                            this._setVariables(viewrenderObj, eventData, this.viewStartAttr, this.viewEndAttr);
                            this._execMF(this._mxObj, this.onviewchangemf, lang.hitch(this, this._prepareEvents));

                        }), eventData);
                    }
                }
            }

            if (this.dataSourceType === "contextmf_viewspecific") {
                this._fetchPaginatedEvents(view.start, view.end);
            }
        },

        _onEventAfterAllRender: function () {
            // if (!this._triggeredRenderAll) {
            //     logger.debug(this.id + "._onEventAfterAllRender");
            //     this._triggeredRenderAll = true;
            //     this._execMF(this._mxObj, this.onviewchangemf, lang.hitch(this, this._prepareEvents));
            // }
        },

        _fetchPaginatedEvents: function(start, end) {
            logger.debug(this.id + "._fetchPaginatedEvents");
            if (this.viewChangeEntity !== "" && this._mxObj) {
                var eventData = {
                    start: start,
                    end: end
                };

                // Has dataview context, so link it via reference
                if (this.viewContextReference !== "" && this._mxObj) {
                    var reference = this.viewContextReference.split("/")[0],
                        refGuid = this._mxObj.getReference(reference);

                    if (refGuid !== "") {
                        mx.data.get({
                            guid: refGuid,
                            callback: lang.hitch(this, this._handlePaginatedObjects, eventData),
                            error: function (err) {
                                console.warn("Error retrieving referenced object: ", err);
                            }
                        });
                    } else {
                        this._createViewChangeEntity(this._handlePaginatedObjects, eventData);
                    }

                } else {
                    // No dataview context
                    this._createViewChangeEntity(this._handlePaginatedObjects, eventData);
                }
            }
        },

        _createViewChangeEntity: function (callback, eventData) {
            logger.debug(this.id + "._createViewChangeEntity");
            mx.data.create({
                entity: this.viewChangeEntity,
                callback: lang.hitch(this, callback, eventData),
                error: function (err) {
                    console.warn("Error creating object: ", err);
                }
            }, this);
        },

        _handlePaginatedObjects: function (eventData, viewrenderObj) {
            logger.debug(this.id + "._handlePaginatedObjects");
            var reference = this.viewContextReference.split("/")[0],
                viewrenderObjId = viewrenderObj.getGuid();

            this._setVariables(viewrenderObj, eventData, this.viewStartAttr, this.viewEndAttr);
            if (this.viewContextReference !== "" && this._mxObj.getReference(reference) !== viewrenderObjId) {
                    this._mxObj.addReference(reference, viewrenderObj.getGuid());
            }
            this._execMF(this._mxObj, this.contextDatasourceMf, lang.hitch(this, this._prepareEvents));
        },

        // This function checks if properties are set which affect rendering of calendar and
        // thus require a destroy action
        _hasDynamicCalendarPropertiesConfigured : function (){
            logger.debug(this.id + "._hasDynamicCalendarPropertiesConfigured");
            if (this.showWeekendsAttribute && this.firstdayAttribute) {
                return true;
            }  else {
                return false;
            }

        },

        uninitialize: function () {
            logger.debug(this.id + ".uninitialize");
            if (this._handles.length > 0) {
                dojoArray.forEach(this._handles, function (handle) {
                    mx.data.unsubscribe(handle);
                });
            }
        }

    });
});
require(["calendar/widget/calendar"], function () {
    "use strict";
});
