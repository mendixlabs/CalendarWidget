/* global dojo */
import {
    defineWidget,
    log,
    runCallback,
} from 'widget-base-helpers';

import $ from 'jquery';
import 'moment';
import 'fullcalendar';
import 'fullcalendar-scheduler';

import dom from 'mxui/dom';
import domConstruct from 'dojo/dom-construct';
import domStyle from 'dojo/dom-style';

import 'fullcalendar/dist/fullcalendar.min.css';
import 'fullcalendar-scheduler/dist/scheduler.min.css';
import './calendar.scss';

/* develblock:start */
import loadcss from 'loadcss';
loadcss(`/widgets/Calendar/widget/ui/calendar.css`);
/* develblock:end */

$.fullCalendar.views.fourWeeks = {
    'class': $.fullCalendar.MonthView,
    duration: {
        weeks: 4,
    },
};

export default defineWidget('calendar', false, {

    _mxObj: null,
    _calendarBox: null,
    _handles: null,
    _header: null,
    _buttonText: null,
    _hasStarted: null,
    _eventIsClicked: false,
    _views: null,
    _colors: null,
    _eventSource: null,
    _fcNode: null,
    _availableViews: null,
    _allowCreate: true,
    _shouldDestroyOnUpdate: false,
    _triggeredRenderAll: false,
    _timeout: null,
    _viewChanged: false,

    constructor() {
        this.log = log.bind(this);
        this.runCallback = runCallback.bind(this);
    },

    postCreate() {
        this.log('postCreate', this._WIDGET_VERSION);

        this._colors = this.notused; //workaround for legacy users
        this._availableViews = this.notused1; //workaround for legacy users
        this._setDefaults(); //set default formatting options
        this._handles = [];
        this._eventSource = [];
        this._allowCreate = this.editable || null !== this.neweventmf && '' !== this.neweventmf;
        this._shouldDestroyOnUpdate = this._hasDynamicCalendarPropertiesConfigured();
        this._viewChanged = false;
    },

    startup() {
        this.log(".startup");

        if (this._hasStarted) {
            return;
        }

        this._hasStarted = true;
        this._calendarBox = domConstruct.create("div", {
            "id": "calendar_" + this.id,
        });

        domConstruct.place(this._calendarBox, this.domNode);

        this._fcNode = $(this._calendarBox);

        this._renderCalendar(null);
    },

    update(obj, callback) {
        this.log(".update");

        this._mxObj = obj;
        this._resetSubscriptions();

        this._fetchObjects();
        this._renderCalendar();

        this.runCallback(callback, "update");
    },

    resize() {
        if (null !== this._timeout) {
            clearTimeout(this._timeout);
            this._timeout = null;
        }

        this._timeout = setTimeout(() => {
            this.log(".resize");
            this._fcNode.fullCalendar("render");
            this._fcNode.fullCalendar("refetchEvents");
            this._timeout = null;
        }, 50);
    },

    _setSchedulerOptions(options) {
        this.log("._setSchedulerOptions");
        const opts = options;

        if (options.views.timelineThreeDays) {
            opts.views.timelineThreeDays = {
                eventLimit: options.views.timelineThreeDays.eventLimit,
                type: "timeline",
                duration: {
                    days: 3,
                },
            };
        }
        opts.resources = [];
        opts.resourceLabelText = this.resourceLabelText;
        opts.schedulerLicenseKey = this.schedulerLicenseKey;

        return opts;
    },

    _getResources(entity, callback) {
        this.log("._getResources");

        mx.data.get({
            xpath: "//" + this.resourceEntity,
            callback: objs => {
                this.log("._getResources callback:", objs ? objs.length + " objects" : "null");
                callback && callback(objs);
            },
            error: function(error) {
                if (callback) {
                    callback();
                }
                console.warn(error.description);
            },
        });
    },

    _prepareResources(resources) {
        this.log("._prepareResources");

        resources.forEach(resource => {
            const fullCalenderResource = {};
            fullCalenderResource.title = resource.get(this.resourceTitle);
            fullCalenderResource.id = resource.getGuid();

            if (this.groupResourcePath) {
                resource.fetch(this.groupResourcePath, group => {
                    if (group) {
                        fullCalenderResource.group = group.get(this.groupTitle);
                    }
                    this._fcNode.fullCalendar("addResource", fullCalenderResource);
                });
                return;
            }
            this._fcNode.fullCalendar("addResource", fullCalenderResource);
        });
    },

    _resetSubscriptions() {
        this.log("._resetSubscriptions");
        this.unsubscribeAll();

        this.subscribe({
            entity: this.eventEntity,
            callback: () => {
                //we re-fetch the objects, and refresh them on the calendar
                this._fetchObjects();
            },
        });

        if (this._mxObj) {

            this.subscribe({
                guid: this._mxObj.getGuid(),
                callback: () => {
                    this._fetchObjects();
                },
            });

            if (this.startPos) {
                this.subscribe({
                    guid: this._mxObj.getGuid(),
                    attr: this.startPos,
                    callback: () => {
                        this._renderCalendar();
                    },
                });
            }

            if (this.firstdayAttribute) {
                this.subscribe({
                    guid: this._mxObj.getGuid(),
                    attr: this.firstdayAttribute,
                    callback: () => {
                        this._renderCalendar();
                    },
                });
            }
            this._onEventAfterAllRender();
        }
    },

    _fetchObjects() {
        this.log("._fetchObjects");

        let constraint = null,
            expectObj = null,
            xpath = null,
            errordiv = null;

        if (this.resourceEntity) {
            this.log("._fetchObjects resources");
            this._getResources(this.resourceEntity, this._prepareResources.bind(this));
        }

        if ('xpath' === this.dataSourceType) {
            this.log("._fetchObjects xpath");
            constraint = this.eventConstraint;
            expectObj = 0 <= this.eventConstraint.indexOf("[%CurrentObject%]");

            if (this._mxObj && expectObj) {
                constraint = this.eventConstraint.replace(/\[%CurrentObject%\]/gi, this._mxObj.getGuid());
            } else if (expectObj) {
                this._clearCalendar();
                return;
            }

            xpath = "//" + this.eventEntity + constraint;
            mx.data.get({
                xpath: xpath,
                callback: this._prepareEvents.bind(this),
            }, this);
        } else if ("contextmf_viewspecific" === this.dataSourceType && this.contextDatasourceMf) {
            this.log("._fetchObjects contextmf_viewspecific");
            if (this._mxObj && this.viewContextReference) {
                const view = this._fcNode.fullCalendar("getView");
                this._fetchPaginatedEvents(view.start, view.end);
            }
        } else if ("contextmf" === this.dataSourceType && this.contextDatasourceMf) {
            this.log("._fetchObjects contextmf", this._mxObj);
            if (this._mxObj) {
                this._execMF(this._mxObj, this.contextDatasourceMf, this._prepareEvents.bind(this));
            }
        } else if ("mf" === this.dataSourceType && this.datasourceMf) {
            this.log("._fetchObjects mf");
            this._execMF(null, this.datasourceMf, this._prepareEvents.bind(this));
        } else if ("simple" === this.dataSourceType) {
            this.log("._fetchObjects simple");
            this._prepareEvents([this._mxObj]);
        } else {

            domConstruct.empty(this.domNode);

            if ("contextmf" === this.dataSourceType) {
                errordiv = dom.div("Data source type 'Microflow with context object' is selected, " +
                "but no microflow was specified for property 'Dataview data source microflow'");
            } else if ("mf" === this.dataSourceType) {
                errordiv = dom.div("Data source type 'Microflow' is selected, but no microflow" +
                " was specified for property 'Data source microflow'");
            } else if ("contextmf_viewspecific" === this.dataSourceType) {
                errordiv = dom.div("Data source type 'Microflow with context object (Retrieve events for each view)' " +
                " is selected, but no microflow was specified for property 'Dataview data source microflow'");
            }

            domStyle.set(errordiv, {
                "border": "1px solid red",
                "color": "red",
                "padding": "5px",
            });

            this.domNode.appendChild(errordiv);
        }
    },

    _clearCalendar() {
        this.log("._clearCalendar");
        if (this._fcNode) {
            this._fcNode.fullCalendar("removeEvents");
        }
    },

    _prepareEvents(objs) {
        this.log("._prepareEvents");

        const objTitles = {};
        const objRefs = [];
        const refTitles = {};
        const split = this.titleAttr.split("/");
        let thisRef = null;

        if ('undefined' === typeof objs || '' === objs || 0 === objs.length) {
            this._clearCalendar();
            return;
        }

        if (1 === split.length) {
            // titleAttr is a simple attribute and the key of objTitles is
            // the GUID of the object and the title is the attribute.
            $.each(objs, (index, obj) => {
                objTitles[ obj.getGuid() ] = obj.get(this.titleAttr);
            });

            this._createEvents(objs, objTitles);
        } else if (3 === split.length) {

            // titleAttr is a reference and we have more work to do.
            $.each(objs, (index, obj) => {
                thisRef = obj.get(split[ 0 ]);
                objTitles[ obj.getGuid() ] = thisRef;
                // objRefs should only contain the unique list of referred objects.
                if (0 > objRefs.indexOf(thisRef)) {
                    objRefs.push(thisRef);
                }
            });
            // Now get the actual title strings from the list of referred objects ...
            // This is an asynchronous call.
            mx.data.get({
                guids: objRefs,
                nocache: false,
                callback: refObjs => {
                    let i = null;

                    // Get the title string for each referenced object and store it
                    // as the value in the refTitles array.
                    for (i = 0; i < refObjs.length; i++) {
                        refTitles[ refObjs[ i ].getGuid() ] = refObjs[ i ].get(split[ 2 ]);
                    }
                    // Now, loop through the objTitles array and replace the value (which is
                    // is the GUID of the referred object) with the actual title string extracted
                    // from the referred object.
                    $.each(objTitles, index => {
                        if (objTitles.hasOwnProperty(index)) {
                            objTitles[ index ] = refTitles[ objTitles[ index ] ];
                        }
                    });
                    // Now that we finally have all of the referenced titles, we can call
                    // createEvents()
                    this._createEvents(objs, objTitles);
                },
            }, this);

        } else {
            // this should never happen and is likely an error
            console.error("Error in titleAttr: " + this.titleAttr + ". This should be either a simple attribute or a 1-deep reference.");
        }
    },

    _createEvents(objs, titles) {
        this.log("._createEvents");

        const events = [];
        let objcolors = null;
        const resourceEventPath = this.resourceEventPath;
        const promises = [];

        $.each(objs, (index, obj) => {

            const promise = $.Deferred(callback => {
                obj.fetch(resourceEventPath, resource => {
                    const resourceRefId = null !== resource ? resource.getGuid() : 0;

                    //get the colors
                    if (0 < this._colors.length && this.typeAttr) {
                        objcolors = this._getObjectColors(obj);
                    }

                    //get the dates
                    const start = new Date(obj.get(this.startAttr));
                    const end = new Date(obj.get(this.endAttr));
                    //create a new calendar event
                    const newEvent = {
                        title: titles[ obj.getGuid() ],
                        resourceId: resourceRefId,
                        start: start,
                        end: end,
                        allDay: '' !== this.alldayAttr ? obj.get(this.alldayAttr) : false,
                        editable: this.editable,
                        mxobject: obj, //we add the mxobject to be able to handle events with relative ease.
                    };

                    if (objcolors) {
                        newEvent.backgroundColor = objcolors.backgroundColor;
                        newEvent.borderColor = objcolors.borderColor;
                        newEvent.textColor = objcolors.textColor;
                    }

                    events.push(newEvent);
                    callback.resolve();
                });
            });
            promises.push(promise);
        });

        $.when(...promises).done(() => {
            //check if the calendar already exists (are we just updating events here?)
            if (this._fcNode.hasClass("fc")) {
                //if it does, remove, add the new source and refetch
                this._fcNode.fullCalendar("render");
                if (this._eventSource && 1 <= this._eventSource.length) {
                    this._fcNode.fullCalendar("removeEventSource", this._eventSource);
                }

                this._fcNode.fullCalendar("addEventSource", events);
                this._fcNode.fullCalendar("refetchEvents");

                // TODO: fix this, because it messes up the contextmf_viewspecific
                if (this._mxObj && '' !== this.startPos && this._mxObj.get(this.startPos)) {
                    this._fcNode.fullCalendar("gotoDate", new Date(this._mxObj.get(this.startPos)));
                }
            } else {
                //else create the calendar
                this._renderCalendar(events);
            }
            this._eventSource = events;
        });
    },

    _renderCalendar(events) {
        const options = this._setCalendarOptions(events);

        // Only destroy calendar when widget configuration requires full rerendering of calendar.
        if (this._shouldDestroyOnUpdate) {
            this._fcNode.fullCalendar("destroy");
        }

        this._fcNode.fullCalendar(options);

        if (this._mxObj && '' !== this.startPos && this._mxObj.get(this.startPos)) {
            this._fcNode.fullCalendar("gotoDate", new Date(this._mxObj.get(this.startPos)));
        } else {
            this._fcNode.fullCalendar("gotoDate", new Date());
        }
    },

    _onEventChange(changeEvt) {
        this.log("._onEventChange");
        const obj = changeEvt.mxobject;
        this._setVariables(obj, changeEvt, this.startAttr, this.endAttr, changeEvt.allDay);
        if (this.resourceEntity && this.resourceEventPath) {
            this._setResourceReference(obj, this.neweventref, changeEvt.resourceId, this._mxObj);
        }
        this._execMF(obj, this.onchangemf);
    },

    _onEventClick(clickEvt) {
        this.log("._onEventClick");
        const obj = clickEvt.mxobject;
        this._setVariables(obj, clickEvt, this.startAttr, this.endAttr, clickEvt.allDay);
        if (this.resourceEntity && this.resourceEventPath) {
            this._setResourceReference(obj, this.neweventref, clickEvt.resourceId, this._mxObj);
        }
        this._execMF(obj, this.onclickmf);
    },

    _onSelectionMade(startDate, endDate, jsEvent, view, resource) {
        this.log("._onSelectionMade");
        const eventData = {
            start: startDate,
            end: endDate,
        };

        const allDay = startDate.hasTime() && endDate.hasTime();

        if (!this._eventIsClicked) {
            mx.data.create({
                entity: this.eventEntity,
                callback: obj => {
                    this._setVariables(obj, eventData, this.startAttr, this.endAttr, allDay);
                    this._setResourceReference(obj, this.neweventref, jsEvent.resourceId, this._mxObj);
                    if ((resource || this._mxObj) && '' !== this.neweventref) {
                        obj.addReference(this.neweventref.split("/")[ 0 ], resource ? resource.id : this._mxObj.getGuid());
                    }
                    this._execMF(obj, this.neweventmf);
                },
                error: err => {
                    console.warn("Error creating object: ", err);
                },
            }, this);

            this._eventIsClicked = true;

            setTimeout(() => {
                this._eventIsClicked = false;
            }, 1000);
        }
    },

    _getObjectColors(obj) {
        this.log("._getObjectColors");

        let objcolors = null;

        $.each(this._colors, (index, color) => { // eslint-disable-line consistent-return
            //set color when enum color equals the color we have on file
            if (obj.get(this.typeAttr) === color.enumKey) {
                objcolors = {
                    backgroundColor: color.bgColor,
                    borderColor: color.border,
                    textColor: color.textColor,
                };

                //We have found the color so we can stop iterating
                return false;
            }
        });

        return objcolors;
    },

    _setVariables(obj, evt, startAttribute, endAttribute, allDay) {
        this.log("._setVariables");

        //update the mx object
        obj.set(startAttribute, evt.start);
        if (null !== evt.end) {
            obj.set(endAttribute, evt.end);
        }

        if ('' !== this.alldayAttr && null !== allDay) {
            obj.set(this.alldayAttr, allDay);
        }
    },

    _setResourceReference(setResRefEvt, resourceReference, resourceId, mxObject) {
        this.log("._setResourceReference");

        if ((resourceId || mxObject) && '' !== resourceReference) {
            setResRefEvt.addReference(
                resourceReference.split("/")[ 0 ],
                resourceId ? resourceId : mxObject.getGuid()
            );
        }
    },

    _setDefaults() {
        this.log("._setDefaults");

        const views = [];

        this._header = {
            left: "title",
            center: "",
        };

        this._buttonText = {};

        this._views = {};

        if (0 < this._availableViews.length) {
            //fill default specifics
            $.each(this._availableViews, (index, view) => {
                const availableViewName = view.availableViews;
                views.push(availableViewName);

                this._views[ availableViewName ] = {};

                const eventLimit = parseInt(view.eventLimit, 10);

                if (!isNaN(eventLimit) && 0 < eventLimit) {
                    this._views[ availableViewName ].eventLimit = eventLimit;
                }

                if ('' !== view.titleFormatViews) {
                    this._views[ availableViewName ].titleFormat = view.titleFormatViews;
                } else if (this.titleFormat) {
                    this._views[ availableViewName ].titleFormat = this.titleFormat;
                }

                if ('' !== view.dateFormatViews) {
                    this._views[ availableViewName ].columnFormat = view.dateFormatViews;
                } else if (this.dateFormat) {
                    this._views[ availableViewName ].columnFormat = this.dateFormat;
                }

                if ('' !== view.timeFormatViews) {
                    this._views[ availableViewName ].timeFormat = view.timeFormatViews;
                } else if ('' !== this.timeFormat) {
                    this._views[ availableViewName ].timeFormat = this.timeFormat;
                }

                if ('' !== view.labelViews) {
                    this._buttonText[ availableViewName ] = view.labelViews;
                }
            });
        } else {
            const viewName = this.defaultView;

            views.push(viewName);
            this._views[ viewName ] = {};

            if (this.titleFormat) {
                this._views[ viewName ].titleFormat = this.titleFormat;
            }

            if (this.timeFormat) {
                this._views[ viewName ].timeFormat = this.timeFormat;
            }

            if (this.dateFormat) {
                this._views[ viewName ].columnFormat = this.dateFormat;
            }
        }

        if (this.todaycaption) {
            this._buttonText.today = this.todaycaption;
        }

        this._header.right =
            (this.todayButton ? "today " : "") +
            (this.singleButton ? views.join() : 2 > views.length ? "" : views.join()) +
            (this.prevnextButton ? " prev,next" : "");

        this.monthNamesFormat = this.monthNamesFormat ? this.monthNamesFormat.split(",") : null;
        this.monthShortNamesFormat = this.monthShortNamesFormat ? this.monthShortNamesFormat.split(",") : null;
        this.dayNamesFormat = this.dayNamesFormat ? this.dayNamesFormat.split(",") : null;
        this.dayShortNamesFormat = this.dayShortNamesFormat ? this.dayShortNamesFormat.split(",") : null;
        this.slotMinutes = this.slotMinutes ? this.slotMinutes : "00:30:00";
        this.slotLabelFormat = this.axisFormat ? this.axisFormat : "h(:mm)a";
        this.startTime = this.startTime ? this.startTime : "08:00";
        this.endTime = this.endTime ? this.endTime : "17:00";
    },

    _getTimeZone() {
        const timezone = this.viewTimeZone ? this.viewTimeZone.replace(/___/ig, '-').replace(/__/ig, '/') : 'local';
        return timezone;
    },

    _setCalendarOptions(events) {

        const defaultView = this._determineDefaultView(this.defaultView, this._views);

        let options = {
            //contents
            header: this._header,
            events: events,
            //configs
            editable: this._allowCreate, //allows resizing events
            selectable: this._allowCreate, //allows selecting a portion of the day or one or multiple days (based on the view)
            //event handling
            eventResize: this._onEventChange.bind(this), //is called when an event is dragged and has changed
            eventDrop: this._onEventChange.bind(this), //is called when an event is dragged and has changed
            eventClick: this._onEventClick.bind(this), //is called when an event is clicked
            viewRender: this._onViewChange.bind(this), //is called when the view (start/end on month, week, etc) has changed
            select: this._onSelectionMade.bind(this), //is called after a selection has been made
            eventAfterAllRender: this._onEventAfterAllRender.bind(this),
            //appearance
            timezone: this._getTimeZone(),
            views: this._views,
            defaultView: defaultView,
            firstDay: this.firstday,
            height: 0 === this.calHeight ? "auto" : this.calHeight,
            weekNumbers: this.showWeekNumbers,
            weekNumberTitle: this.weeknumberTitle,
            weekends: this.showWeekends,
            slotDuration: this.slotMinutes,
            slotLabelFormat: this.slotLabelFormat,
            buttonText: this._buttonText,
            locale: this.languageSetting,
            eventLimit: this.limitEvents,
            scrollTime: this.scrollTime,
        };

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
                dow: [1, 2, 3, 4, 5],
            };
        }

        if (this._mxObj) {
            if (this.showWeekendsAttribute) {
                options.weekends = this._mxObj.get(this.showWeekendsAttribute);
            }
            if (this.firstdayAttribute) {
                options.firstDay = this._mxObj.get(this.firstdayAttribute);
            }
        }

        if (this.resourceEntity) {
            options = this._setSchedulerOptions(options);
        } else {
            options.schedulerLicenseKey = "GPL-My-Project-Is-Open-Source";
            // This key is set to make sure we don't get the "valid license key" message
            // in our calendar. This must be set in the modeler (part of Calendar with Scheduler)
        }

        if (this.groupResourcePath) {
            options.resourceGroupField = 'group';
        }

        this.log("._setCalendarOptions", options);
        return options;
    },

    _execMF(obj, mf, cb) {
        if (mf) {
            const params = {
                applyto: "selection",
                actionname: mf,
                guids: [],
            };
            if (obj) {
                params.guids = [obj.getGuid()];
            }
            this.log("._execMF params:", params);

            const action = {
                params: params,
                callback: objs => {
                    this.log("._execMF callback:", objs ? objs.length + " objects" : "null");
                    if (cb) {
                        cb(objs);
                    }
                },
                error: error => {
                    if (cb) {
                        cb();
                    }
                    console.warn(error.description);
                },
            };

            if (!mx.version || mx.version && 7 > parseInt(mx.version.split(".")[ 0 ], 10)) {
                action.store = {
                    caller: this.mxform,
                };
            } else {
                action.origin = this.mxform;
            }

            this.log("._execMF", mf, action);
            mx.data.action(action, this);
        } else if (cb) {
            this.log("._execMF: no microflow defined");
            cb();
        }
    },

    _onViewChange(view) {
        this.log("._onViewChange");

        const eventData = {
            start: view.start,
            end: view.end,
        };

        if (this.onviewchangemf && '' !== this.onviewchangemf) {
            if (this.viewContextReference && '' !== this.viewContextReference && this._mxObj) {
                const ref = this.viewContextReference.split("/")[ 0 ];
                const refGuid = this._mxObj.getReference(ref);

                this.log("._onViewChange viewContextRef: " + refGuid);
                if ('' !== refGuid) {
                    mx.data.get({
                        guid: refGuid,
                        callback: viewrenderObj => {
                            this._setVariables(viewrenderObj, eventData, this.viewStartAttr, this.viewEndAttr);
                            this._execMF(this._mxObj, this.onviewchangemf, this._prepareEvents.bind(this));
                        },
                        error: function(err) {
                            console.warn("Error retrieving referenced object: ", err);
                        },
                    });
                } else {
                    const cb = (viewrenderObj, evtData) => {
                        this._mxObj.addReference(ref, viewrenderObj.getGuid());
                        this._setVariables(viewrenderObj, evtData, this.viewStartAttr, this.viewEndAttr);
                        this._execMF(this._mxObj, this.onviewchangemf, this._prepareEvents.bind(this));
                    };
                    this._createViewChangeEntity(cb, eventData);
                }
            }
        }

        if ('contextmf_viewspecific' === this.dataSourceType) {
            this.log("._onViewChange contextmf_viewspecific");
            this._fetchPaginatedEvents(view.start, view.end);
        }
    },

    _onEventAfterAllRender(view) {
        if (view && ('agendaWeek' === view.type || 'agendaDay' === view.type)) {
            this.log("._onEventAfterAllRender");
            view.applyDateScroll(view.computeInitialDateScroll());
            // fixing issue with initial scrolltime (https://github.com/mendix/Calendar/issues/45)
        }
    },

    _fetchPaginatedEvents(start, end) {
        this.log("._fetchPaginatedEvents");

        if ('' !== this.viewChangeEntity && this._mxObj) {
            const eventData = {
                start: start,
                end: end,
            };

            // Has dataview context, so link it via reference
            if ('' !== this.viewContextReference && this._mxObj) {
                const reference = this.viewContextReference.split("/")[ 0 ];
                const refGuid = this._mxObj.getReference(reference);

                if ('' !== refGuid) {
                    mx.data.get({
                        guid: refGuid,
                        callback: obj => {
                            this._handlePaginatedObjects(obj, eventData);
                        },
                        error: function(err) {
                            console.warn("Error retrieving referenced object: ", err);
                        },
                    });
                } else {
                    this._createViewChangeEntity(this._handlePaginatedObjects.bind(this), eventData);
                }

            } else {
                // No dataview context
                this._createViewChangeEntity(this._handlePaginatedObjects.bind(this), eventData);
            }
        }
    },

    _createViewChangeEntity(callback, eventData) {
        this.log("._createViewChangeEntity", eventData);
        mx.data.create({
            entity: this.viewChangeEntity,
            callback: obj => {
                callback(obj, eventData);
            },
            error: function(err) {
                console.warn("Error creating object: ", err);
            },
        }, this);
    },

    _handlePaginatedObjects(viewrenderObj, eventData) {
        this.log("._handlePaginatedObjects", viewrenderObj, eventData);

        const reference = this.viewContextReference.split("/")[ 0 ];
        const viewrenderObjId = viewrenderObj.getGuid();

        this._setVariables(viewrenderObj, eventData, this.viewStartAttr, this.viewEndAttr);

        if ('' !== this.viewContextReference && this._mxObj.getReference(reference) !== viewrenderObjId) {
            this._mxObj.addReference(reference, viewrenderObj.getGuid());
        }
        this._execMF(this._mxObj, this.contextDatasourceMf, this._prepareEvents.bind(this));
    },

    _hasDynamicCalendarPropertiesConfigured() {
        this.log("._hasDynamicCalendarPropertiesConfigured");
        return this.showWeekendsAttribute && this.firstdayAttribute;
    },

    _determineDefaultView(userDefinedDefaultView, availableViews){
        const available = Object.keys(availableViews);
        const exists = dojo.indexOf(available, userDefinedDefaultView);
        let defaultView = userDefinedDefaultView;
        if (0 > exists) {
            defaultView = available[ 0 ];
        }

        return defaultView;
    },

});
