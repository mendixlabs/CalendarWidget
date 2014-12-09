mxui.dom.addCss(dojo.moduleUrl("calendar.lib", "fullcalendar.css"));
dojo.require("calendar.lib.jquery-min");
dojo.require("calendar.lib.jquery-ui-min");
dojo.require("calendar.lib.fullcalendar-min");


(function($) {
	dojo.declare("calendar.widget.calendar", mxui.widget._WidgetBase, {
		_mxObj            : null,
		_calendarBox      : null,
		_subscription	  : null,
		_header			  : null,
        _buttonText       : null,
		_hasStarted		  : null,
        _eventIsClicked   : false,
        _timeFormat       : null,
		colors			  : null,
		eventSource       : null,
		fcNode            : null,

		startup : function() {
			if (this._hasStarted)
				return;
			
			this._hasStarted = true;
			
			this.colors = this.notused; //workaround for legacy users
			this.availableViews = this.notused1;//workaround for legacy users
			this.setDefaults(); //set default formatting options

			this.eventSource = [];
			
			//make a calendarbox
			this._calendarBox = dojo.create('div', {'id' : 'calendar_' + this.id});
			dojo.place(this._calendarBox, this.domNode);
			
			this.fcNode = $('#calendar_' + this.id);

			this.renderCalendar(null);

			//subscribe to changes in the event entity. 
			this._subscription = mx.data.subscribe({
				entity: this.eventEntity,
				callback: dojo.hitch(this, function(entity) {
					//we re-fetch the objects, and refresh them on the calendar
					this.fetchObjects();
				})
			});
			this.actLoaded();
		},

		update : function(obj, callback) {
			this._mxObj = obj;

			this.fetchObjects();
			callback && callback();
		}, 
		
		fetchObjects : function () {
			if (this.dataSourceType === "xpath") {
				var constraint = this.eventConstraint;
				var expectObj = this.eventConstraint.indexOf('[%CurrentObject%]') >= 0;

				if(this._mxObj && expectObj){
					constraint = this.eventConstraint.replace(/\[%CurrentObject%\]/gi, this._mxObj.getGuid());
				} else if (expectObj) {
					this.clearCalendar();
					return;
				}
				
				var xpath = '//' + this.eventEntity + constraint;
				mx.data.get({
					xpath : xpath,
					callback : dojo.hitch(this, this.prepareEvents)
				}, this);
			}
			else if (this.dataSourceType === "contextmf" && this._mxObj && this.contextDatasourceMf)
				this.execMF(this._mxObj, this.contextDatasourceMf, dojo.hitch(this, this.prepareEvents));
			else if(this.dataSourceType === "mf" && this.datasourceMf)
				this.execMF(null, this.datasourceMf, dojo.hitch(this, this.prepareEvents));
			else {
				dojo.empty(this.domNode);
				var errordiv = mxui.dom.div("The data source settings do not seem to match up. Please re-configure them.");
				dojo.style(errordiv, {
					"border" : "1px solid red",
					"color" : "red",
					"padding" : "5px"
				});
				this.domNode.appendChild(errordiv);
			}
		}, 

		clearCalendar : function() {
			if (this.fcNode)
				this.fcNode.fullCalendar('removeEvents');
		},

		prepareEvents : function(objs) {
			// this function takes a set of objects and gets a title for each based on whether titleAttr
			// is a simple attribute or a reference.  When titles are collected, we call
			// createEvents with both the original objects and the objTitles array.
			// Note: for referenced titles, the createObjects call is made from the callback of mx.processor.get()
			var objTitles = {}; // key = object GUID, value is ultimately the title string
			// Note: for referenced title attributes, the value is initially set to the GUID
			// of the referenced object.  Later, during the mx.processor.get() callback, it
			// is replaced with the actual title string.
			var objRefs = []; // Array containing the referenced object GUIDs.
			var refTitles = {};  // key = referenced object GUID, value is referred title
			// Note: both objRefs and refTitles will be the same length, but both of them can be shorter
			// than the length of objRefs.
			var split = this.titleAttr.split("/");
			if (split.length == 1 ) {
				// titleAttr is a simple attribute and the key of objTitles is
				// the GUID of the object and the title is the attribute.
				$.each(objs, dojo.hitch(this, function(index, obj){
					objTitles[obj.getGUID()] = obj.get(this.titleAttr);
				}));
				this.createEvents(objs, objTitles);
			} else if (split.length == 3 ) {
				// titleAttr is a reference and we have more work to do.
				var thisRef; // Contains the GUID of one of the referred objects.
				$.each(objs, function(index, obj){
					thisRef = obj.getAttribute(split[0]);
					objTitles[obj.getGUID()] = thisRef;
					// objRefs should only contain the unique list of referred objects.
					if (objRefs.indexOf(thisRef) < 0) {
						objRefs.push(thisRef);
					}
				});
				// Now get the actual title strings from the list of referred objects ...
				// This is an asynchronous call.
				mx.processor.get({
					guids : objRefs,
					nocache : false,
					callback : function (refObjs) {
						// Get the title string for each referenced object and store it
						// as the value in the refTitles array.
						for (var i = 0; i < refObjs.length; i++ ) {
							refTitles[refObjs[i].getGUID()] = refObjs[i].get(split[2]);
						}
						// Now, loop through the objTitles array and replace the value (which is
						// is the GUID of the referred object) with the actual title string extracted
						// from the referred object.
						for (var index in objTitles) {
							var thisValue = objTitles[index];
							objTitles[index] = refTitles[objTitles[index]];
						}
						// Now that we finally have all of the referenced titles, we can call
						// createEvents()
						this.createEvents(objs, objTitles);
					}
				}, this);
				//this.createEvents(objs, objTitles);
			} else {
				// this should never happen and is likely an error
				console.error("Error in titleAttr: " + this.titleAttr+". This should be either a simple attribute or a 1-deep reference.");
			}
		},

		createEvents : function(objs, titles) {
			var events = [];
			var objcolors = null;
			$.each(objs, dojo.hitch(this, function(index, obj){
				//get the colors
				if(this.colors.length > 0 && this.typeAttr){
					objcolors = this.getObjectColors(obj);
				}
				//get the dates
				var start = new Date(obj.get(this.startAttr));
				var end = new Date(obj.get(this.endAttr));
				//create a new calendar event
				var newEvent = {
					title : titles[obj.getGUID()],
					start : start,
					end	: end,
					allDay : obj.get(this.alldayAttr),
					editable : this.editable, 
					mxobject: obj //we add the mxobject to be able to handle events with relative ease.
				};

				if(objcolors){
					newEvent.backgroundColor = objcolors.backgroundColor;
					newEvent.borderColor = objcolors.borderColor;
					newEvent.textColor = objcolors.textColor;
				}
				events.push(newEvent);
			}));
			//check if the calendar already exists (are we just updating events here?)
			if(this.fcNode.hasClass('fc')){
				//if it does, remove, add the new source and refetch
				this.fcNode.fullCalendar('render');
				if (this.eventSource && this.eventSource.length >= 1)		
					this.fcNode.fullCalendar('removeEventSource', this.eventSource);

				this.fcNode.fullCalendar('addEventSource', events);
				this.fcNode.fullCalendar('refetchEvents');
			} else {
				//else create the calendar
				this.renderCalendar(events);
			}
			this.eventSource = events;
		},

		renderCalendar: function (events) {			
			var options = this.setCalendarOptions(events);

			this.fcNode.fullCalendar(options);

			//go to the startposition if we have one
			if (this._mxObj && this._mxObj.get(this.startPos)) {
				this.fcNode.fullCalendar('gotoDate', new Date(this._mxObj.get(this.startPos)));
			}
		}, 

		onEventChange : function(event,dayDelta,minuteDelta,allDay,revertFunc){ 
			var obj = event.mxobject;
			this.setVariables(obj, event, allDay);
			this.execMFFromUI(obj, this.onchangemf);
		}, 

		onEventClick : function(event) {
            var obj = event.mxobject;
            this.setVariables(obj, event);
            this.execMFFromUI(obj, this.onclickmf);
		},

		onSelectionMade : function(startDate, endDate, allDay, jsEvent, view) {
			var eventData = {
				start : startDate,
				end	: endDate
			};
        
            if(!this._eventIsClicked){
        
                mx.data.create({
                    entity: this.eventEntity,
                    callback: function(obj) {
                        this.setVariables(obj, eventData, allDay);
                        if(this._mxObj && this.neweventref !== '') {
                            obj.addReference(this.neweventref.split('/')[0], this._mxObj.getGuid());
                        }
                        this.execMF(obj, this.neweventmf);
                    },
                    error: function(err){ 
                        logger.warn('Error creating object: ', err);
                    }
                }, this);
                
                this._eventIsClicked = true;

                setTimeout( dojo.hitch(this,function(){
                    this._eventIsClicked = false;
                }),1000);
            }
		},

		getObjectColors : function(obj){
			var objcolors = null;
			var self = this;
			$.each(this.colors, function(index, color){
				//set color when enum color equals the color we have on file
				if(obj.get(self.typeAttr) === color.enumKey){
					objcolors = {
						backgroundColor : color.bgColor,
						borderColor : color.border,
						textColor : color.textColor
					};
				}
			});

			return objcolors;
		},

		setVariables : function(obj, event, allDay){
			//update the mx object
			obj.set(this.startAttr, event.start);
			if (event.end !== null)
				obj.set(this.endAttr, event.end);

			if(allDay !== null){
				obj.set(this.alldayAttr, allDay);
			}
		},

		setDefaults : function(){
			var views = [];

			this._header = {
				left: 'title',
				center: ''
			};

			this.titleFormat = this.titleFormat ? this.titleFormat : {
				month: 'MMMM yyyy',                             // September 2009
				week: "MMM d[ yyyy]{ '&#8212;'[ MMM] d yyyy}", // Sep 7 - 13 2009
				day: 'dddd, MMM d, yyyy'                  // Tuesday, Sep 8, 2009
			};
			this.dateFormat = this.dateFormat ? this.dateFormat : {
				month: 'ddd',    // Mon
				week: 'ddd M/d', // Mon 9/7
				day: 'dddd M/d'  // Monday 9/7
			};
			this._timeFormat =  {};
            if(this.timeFormat){
                this._timeFormat[''] = this.timeFormat ;
            }
            
            this._buttonText = {};

            this.axisFormat = this.axisFormat ? this.axisFormat : 'h(:mm)tt' ;
			
			if(this.availableViews.length > 0){
				//fill default specifics				
                $.each(this.availableViews, dojo.hitch(this,function(index, view){
					var viewName = view.availableViews;
					views.push(viewName);
					if(view.titleFormatViews !== ''){
                        this.titleFormat[viewName] = view.titleFormatViews;
					}
					if(view.dateFormatViews !== '') {
                        this.dateFormat[viewName] = view.dateFormatViews;
					}
					if(view.timeFormatViews !== '') {
                        this._timeFormat[viewName] = view.timeFormatViews;
					}

					if(view.labelViews !== '') {
                        this._buttonText[viewName] = view.labelViews;
					}
				}));
			
			} 

			this._header.right = 'today '+ views.join() +' prev,next';		

			this.monthNamesFormat = this.monthNamesFormat ? this.monthNamesFormat.split(",") : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
			this.monthShortNamesFormat = this.monthShortNamesFormat ? this.monthShortNamesFormat.split(",") : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
			this.dayNamesFormat = this.dayNamesFormat ? this.dayNamesFormat.split(",") : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
			this.dayShortNamesFormat = this.dayShortNamesFormat ? this.dayShortNamesFormat.split(",") : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
		},

		setCalendarOptions : function(events){
			var options = {
				//contents
				header : this._header,
				events: events,
				//configs
				editable: true, //allows resizing events
				selectable: true, //allows selecting a portion of the day or one or multiple days (based on the view)
				//event handling
                eventResize: dojo.hitch(this, this.onEventChange), //is called when an event is dragged and has changed
				eventDrop: dojo.hitch(this, this.onEventChange), //is called when an event is dragged and has changed
				eventClick: dojo.hitch(this, this.onEventClick), //is called when an event is clicked
				select: dojo.hitch(this, this.onSelectionMade), //is called after a selection has been made
				//appearance
				defaultView: this.defaultView,
				firstDay: this.firstday,
				height: this.calHeight, 
				weekNumbers: this.showWeekNumbers,
				weekNumberTitle: this.weeknumberTitle, 
				weekends: this.showWeekends,
				slotMinutes: this.slotMinutes,
                buttonText: this._buttonText,
				//Agenda view formatting
				axisFormat: this.axisFormat,
				//Text/Time Formatting
				titleFormat: this.titleFormat,
				timeFormat: this._timeFormat,
				columnFormat: this.dateFormat,
				monthNames: this.monthNamesFormat, 
				monthNamesShort: this.monthShortNamesFormat,
				dayNames: this.dayNamesFormat,
				dayNamesShort: this.dayShortNamesFormat
			};

			return options;
		},

        execMF : function (obj, mf, cb) {
            if (mf) {
                var params = {
                applyto : "selection",
                actionname : mf,
                guids : []
            };
            if (obj)
                params.guids = [obj.getGuid()];
                
                mx.data.action({
                    params : params,
                    callback	: function(objs) {
                        cb && cb(objs);
                    },
                    error	: function(error) {
                        cb && cb();
                        logger.warn(error.description);
                    }
                }, this);
            } else if (cb) {
                cb();
            }
        }, 
		
        execMFFromUI : function (obj, mf, cb) {
			if (mf) {
				var params = {
					applyto		: "selection",
					guids : []
				};
				if (obj)
					params.guids = [obj.getGuid()];
                
                mx.ui.action(mf, {
                    context: new mendix.lib.MxContext(),
                    progress: "modal",
                    params	: params,	
                    callback: function(result) {
                        cb && cb(objs);
                    }
                });
                
			} else if (cb) {
				cb();
			}
				
		}, 

		uninitialize: function(){
			mx.data.unsubscribe(this._subscription);
		}

	});

})(calendar.lib.$);