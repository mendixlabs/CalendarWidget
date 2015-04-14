/*jslint white:true, nomen: true, plusplus: true */
/*global mx, define, require, browser, devel, console */
/*mendix */
/*
    Calendar
    ========================

	@file      : calendar.js
	@version   : 4.0
	@author    : Pauline Oudeman - van der Kraats, Robert van 't Hof, Richard Edens, Roeland Salij
	@date      : 06-02-2015
	@copyright : Mendix Technology BV
	@license   : Apache License, Version 2.0, January 2004

	Documentation
    ========================
	FullCalendar implementation.
*/

// Required module list. Remove unnecessary modules, you can always get them back from the boilerplate.
require({
	packages: [{
			name: 'jquery',
			location: '../../widgets/calendar/lib',
			main: 'jquery-2.1.1.min'
    },
		{
			name: 'moment',
			location: '../../widgets/calendar/lib',
			main: 'moment.min'
               },
		{
			name: 'fullCalendar',
			location: '../../widgets/calendar/lib',
			main: 'fullcalendar.min'
               },
		{
			name: 'calendarLang',
			location: '../../widgets/calendar/lib',
			main: 'lang-all'
               }
              ]
}, [
    'dojo/_base/declare', 'mxui/widget/_WidgetBase', 'dijit/_TemplatedMixin',
    'mxui/dom', 'dojo/dom', 'dojo/query', 'dojo/dom-prop', 'dojo/dom-geometry', 'dojo/dom-class', 'dojo/dom-style', 'dojo/dom-construct', 'dojo/_base/array', 'dojo/_base/lang', 'dojo/text',
    'jquery', 'moment', 'fullCalendar', 'calendarLang', 'dojo/text!calendar/widget/template/Calendar.html'
], function (declare, _WidgetBase, _TemplatedMixin, dom, dojoDom, domQuery, domProp, domGeom, domClass, domStyle, domConstruct, dojoArray, lang, text, $, moment, fullCalendar, calendarLang, widgetTemplate) {
	'use strict';

	// Declare widget's prototype.
	return declare('calendar.widget.calendar', [_WidgetBase, _TemplatedMixin], {
		// _TemplatedMixin will create our dom node using this HTML template.
		templateString: widgetTemplate,

		// Internal variables. Non-primitives created in the prototype are shared between all widget instances.
		_mxObj: null,
		_calendarBox: null,
		_handles: null,
		_header: null,
		_buttonText: null,
		_hasStarted: null,
		_eventIsClicked: false,
		_views	: null,
		_titleFormat: null,
		_dateFormat: null,
		_timeFormat: null,
		_colors: null,
		_eventSource: null,
		_fcNode: null,
		_availableViews: null,
		_allowCreate: true,

		postCreate: function () {
			console.debug('Calendar - startup');
			
			this._colors = this.notused; //workaround for legacy users
			this._availableViews = this.notused1; //workaround for legacy users
			this._setDefaults(); //set default formatting options
			this._handles = [];
			this._eventSource = [];
			this._allowCreate = this.editable || (this.neweventmf !== null && this.neweventmf !== '');
			//make a calendarbox
			this._calendarBox = dom.create('div', {
				'id': 'calendar_' + this.id
			});
			domConstruct.place(this._calendarBox, this.domNode);

			this._fcNode = $('#calendar_' + this.id);

			this._renderCalendar(null);

		},

		update: function (obj, callback) {
			console.debug('Calendar - update');

			if (this._handles.length > 0) {
				dojoArray.forEach(this._handles, function (handle) {
					mx.data.unsubscribe(handle);
				});
			}
            this._handles = [];

			if (obj) {
				this._mxObj = obj;
				this._fetchObjects();
			}

			//subscribe to changes in the event entity and context object(if applicable). 
			this._addSubscriptions();
			
			if (typeof callback !== 'undefined') {
				callback();
			}
		},

		resize: function () {
			console.debug('Calendar - resize');
			this._fcNode.fullCalendar('render');
			this._fetchObjects();
		},

		_addSubscriptions: function () {
			var subscription = mx.data.subscribe({
					entity: this.eventEntity,
					callback: lang.hitch(this, function (entity) {
						//we re-fetch the objects, and refresh them on the calendar
						this._fetchObjects();
					})
				}),
				contextSubscription = null;
			
			this._handles.push(subscription);
			
			if (this._mxObj){
				contextSubscription = mx.data.subscribe({
					guid: this._mxObj.getGuid(),
					callback: lang.hitch(this, function (guid) {
						this._fetchObjects();
					})
				});
				
				this._handles.push(contextSubscription);
			}
	
		},

		_fetchObjects: function () {
			console.debug('Calendar - fetch objects');
			var constraint = null,
				expectObj = null,
				xpath = null,
				errordiv = null;

			if (this.dataSourceType === "xpath") {
				constraint = this.eventConstraint;
				expectObj = this.eventConstraint.indexOf('[%CurrentObject%]') >= 0;

				if (this._mxObj && expectObj) {
					constraint = this.eventConstraint.replace(/\[%CurrentObject%\]/gi, this._mxObj.getGuid());
				} else if (expectObj) {
					this._clearCalendar();
					return;
				}

				xpath = '//' + this.eventEntity + constraint;
				mx.data.get({
					xpath: xpath,
					callback: lang.hitch(this, this._prepareEvents)
				}, this);
			} else if (this.dataSourceType === "contextmf" && this.contextDatasourceMf) {

				if (this._mxObj) {
					this._execMF(this._mxObj, this.contextDatasourceMf, lang.hitch(this, this._prepareEvents));
				}
			} else if (this.dataSourceType === "mf" && this.datasourceMf) {
				this._execMF(null, this.datasourceMf, lang.hitch(this, this._prepareEvents));
			} else {

				domConstruct.empty(this.domNode);
				if (this.dataSourceType === "contextmf") {
					errordiv = dom.div("Data source type 'Microflow with context object' is selected, but no microflow was specified for property 'Dataview data source microflow'");
				} else if (this.dataSourceType === "mf") {
					errordiv = dom.div("Data source type 'Microflow' is selected, but no microflow was specified for property 'Data source microflow'");
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
			console.debug('Calendar - clear calendar');
			if (this._fcNode) {
				this._fcNode.fullCalendar('removeEvents');
			}
		},

		_prepareEvents: function (objs) {
			console.debug('Calendar - prepare events');
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

			if (split.length === 1) {
				// titleAttr is a simple attribute and the key of objTitles is
				// the GUID of the object and the title is the attribute.
				$.each(objs, lang.hitch(this, function (index, obj) {
					objTitles[obj.getGUID()] = obj.get(this.titleAttr);
				}));
				this._createEvents(objs, objTitles);
			} else if (split.length === 3) {

				// titleAttr is a reference and we have more work to do.
				$.each(objs, function (index, obj) {
					thisRef = obj.getAttribute(split[0]);
					objTitles[obj.getGUID()] = thisRef;
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
							index = null,
							thisValue = null;

						// Get the title string for each referenced object and store it
						// as the value in the refTitles array.
						for (i = 0; i < refObjs.length; i++) {
							refTitles[refObjs[i].getGUID()] = refObjs[i].get(split[2]);
						}
						// Now, loop through the objTitles array and replace the value (which is
						// is the GUID of the referred object) with the actual title string extracted
						// from the referred object.
						for (index in objTitles) {
							if (objTitles.hasOwnProperty(index)) {
								thisValue = objTitles[index];
								objTitles[index] = refTitles[objTitles[index]];
							}
						}
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
			console.debug('Calendar - create events');
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
						title: titles[obj.getGUID()],
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
			if (this._fcNode.hasClass('fc')) {
				//if it does, remove, add the new source and refetch
				this._fcNode.fullCalendar('render');
				if (this._eventSource && this._eventSource.length >= 1) {
					this._fcNode.fullCalendar('removeEventSource', this._eventSource);
				}

				this._fcNode.fullCalendar('addEventSource', events);
				this._fcNode.fullCalendar('refetchEvents');
			} else {
				//else create the calendar
				this._renderCalendar(events);
			}
			this._eventSource = events;
		},

		_renderCalendar: function (events) {
			console.debug('Calendar - render calendar');
			var options = this._setCalendarOptions(events);

			this._fcNode.fullCalendar(options);

			//go to the startposition if we have one
			if (this._mxObj && this._mxObj.get(this.startPos)) {
				this._fcNode.fullCalendar('gotoDate', new Date(this._mxObj.get(this.startPos)));
			}
		},

		_onEventChange: function (event, dayDelta, minuteDelta, allDay, revertFunc) {
			console.debug('Calendar - on event change');
			var obj = event.mxobject;
			this._setVariables(obj, event, this.startAttr, this.endAttr, allDay);
			this._execMF(obj, this.onchangemf);
		},

		_onEventClick: function (event) {
			console.debug('Calendar - on event click');
			var obj = event.mxobject;
			this._setVariables(obj, event, this.startAttr, this.endAttr);
			this._execMF(obj, this.onclickmf);
		},

		_onSelectionMade: function (startDate, endDate, allDay, jsEvent, view) {
			console.debug('Calendar - on selection made');
			var eventData = {
				start: startDate,
				end: endDate
			};

			if (!this._eventIsClicked) {

				mx.data.create({
					entity: this.eventEntity,
					callback: function (obj) {
						this._setVariables(obj, eventData, this.startAttr, this.endAttr, allDay);
						if (this._mxObj && this.neweventref !== '') {
							obj.addReference(this.neweventref.split('/')[0], this._mxObj.getGuid());
						}
						this._execMF(obj, this.neweventmf);
					},
					error: function (err) {
						console.warn('Error creating object: ', err);
					}
				}, this);

				this._eventIsClicked = true;

				setTimeout(lang.hitch(this, function () {
					this._eventIsClicked = false;
				}), 1000);
			}
		},

		_getObjectColors: function (obj) {
		console.debug('Calendar - get object colors ' + obj.getGUID());

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
			console.debug('Calendar - set variables');
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
			console.debug('Calendar - set defaults');
			var views = [];

			this._header = {
				left: 'title',
				center: ''
			};

			this._titleFormat = {
				month: 'MMMM YYYY', // September 2009
				week: "MMM D YYYY", // Sep 13 2009
				day: 'MMMM D YYYY' //  Sep 8, 2009
			};

			if (this.titleFormat) {
				this._titleFormat[''] = this.titleFormat;
			}

			this._dateFormat = this.dateFormat || {
				month: 'ddd', // Mon
				week: 'ddd M/D', // Mon 9/7
				day: 'dddd M/D' // Monday 9/7
			};

			if (this.dateFormat) {
				this._dateFormat[''] = this.dateFormat;
			}

			this._timeFormat = {};
			if (this.timeFormat) {
				this._timeFormat[''] = this.timeFormat;
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
					
					if (view.titleFormatViews !== '') {
						this._titleFormat[viewName] = view.titleFormatViews;
					}
					if (view.dateFormatViews !== '') {
						this._dateFormat[viewName] = view.dateFormatViews;
					}
					if (view.timeFormatViews !== '') {
						this._timeFormat[viewName] = view.timeFormatViews;
					}

					if (view.labelViews !== '') {
						this._buttonText[viewName] = view.labelViews;
					}
				}));

			}

			if (this.todaycaption) {
				this._buttonText.today = this.todaycaption;
			}

			this._header.right = 'today ' + views.join() + ' prev,next';

			this.monthNamesFormat = this.monthNamesFormat ? this.monthNamesFormat.split(",") : null;
			this.monthShortNamesFormat = this.monthShortNamesFormat ? this.monthShortNamesFormat.split(",") : null;
			this.dayNamesFormat = this.dayNamesFormat ? this.dayNamesFormat.split(",") : null;
			this.dayShortNamesFormat = this.dayShortNamesFormat ? this.dayShortNamesFormat.split(",") : null;
			this.slotMinutes = this.slotMinutes ? this.slotMinutes : '00:30:00';
			this.startTime = this.startTime ? this.startTime : '08:00';
			this.endTime = this.endTime ? this.endTime : '17:00';

		},

		_setCalendarOptions: function (events) {
			console.debug('Calendar - set calendar options');
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
				//appearance
				timezone: 'local',
				views : this._views,
				defaultView: this.defaultView,
				firstDay: this.firstday,
				height: this.calHeight,
				weekNumbers: this.showWeekNumbers,
				weekNumberTitle: this.weeknumberTitle,
				weekends: this.showWeekends,
				slotDuration: this.slotMinutes,
				buttonText: this._buttonText,
				lang: this.languageSetting,
				eventLimit: this.limitEvents
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
			return options;
		},

		_execMF: function (obj, mf, cb) {
			if (mf) {
				var params = {
					applyto: "selection",
					actionname: mf,
					guids: []
				};
				if (obj) {
					params.guids = [obj.getGuid()];
				}
				mx.data.action({
					params: params,
					callback: function (objs) {
						if (cb) {
							cb(objs);
						}
					},
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

		//            _execMFFromUI : function (obj, mf, cb) {
		//                console.debug('Calendar - exec mf from ui');
		//                if (mf) {
		//                    var params = {
		//                        applyto		: "selection",
		//                        guids : []
		//                    };
		//                    if (obj) {
		//                        params.guids = [obj.getGuid()];
		//                    }
		//
		//                    mx.ui.action(mf, {
		//                        context: new mendix.lib.MxContext(),
		//                        progress: "modal",
		//                        params	: params,	
		//                        callback: function(result) {
		//                            if (cb) {
		//                                cb(result);
		//                            }
		//                        }
		//                    });
		//
		//                } else if (cb) {
		//                    cb();
		//                }
		//
		//            }, 

		_onViewChange: function (view, element) {
				
			if(this.viewChangeEntity !== '') {
				var eventData = {
					start: view.start,
					end: view.end
				};
			
				mx.data.create({
					entity: this.viewChangeEntity,
					callback: function (obj) {
						this._setVariables(obj, eventData, this.viewStartAttr, this.viewEndAttr);
						this._execMF(obj, this.onviewchangemf);
					},
					error: function (err) {
						console.warn('Error creating object: ', err);
					}
				}, this);
			}
		},

		uninitialize: function () {
			if (this._handles.length > 0) {
				dojoArray.forEach(this._handles, function (handle) {
					mx.data.unsubscribe(handle);
				});
			}
		}

	});
});