dojo.provide("calendar.widget.calendar");
mendix.dom.insertCss(mx.moduleUrl('calendar') + 'widget/lib/fullcalendar.css');

var ___calendarsource = {
	addons       : [mendix.addon._Contextable],
	inputargs: {
		evtEntity : '',
		startPos : '',
		evtConstraint : '',
		onchangemf : '',
		onclickmf : '',
		neweventmf : '',
		neweventref : '',
		onviewchangemf : '',
		listenchannel : '',
		calHeight : 600,
		titleAttr : '',
		startAttr : '',
		endAttr : '',
		alldayAttr : '',
		urlAttr : '',
		customSortAttr : '',
		customSortOrder : 'asc',
		readonlyVal : false,
		
		typeAttr : '',
		enumKey : '',
		bgColor : '',
		border : '',
		textColor : '',
		
		showWeekends : true,
		defaultView : '',
		
		availableViews : '',
		timeFormatViews : '',
		dateFormatViews : '',
		titleFormatViews : '',
		labelViews : '',
		
		timeFormat : '',
		dateFormat : '',
		titleFormat : '',
		firstday : 0,
		showWeekNumbers: false,
		weeknumberTitle: '',

		monthNamesFormat : '',
		monthShortNamesFormat : '',
		dayNamesFormat : '',
		dayShortNamesFormat : '',

		alldayTranslate : '',
		todayTranslate : '',
		monthTranslate : '',
		weekTranslate : '',
		dayTranslate : '',
		startTime : 0,
		endTime : 0
	},
	
	contextGUID : null,
	_hasStarted : false,
	
	//MX5 color fix
	fixObjProps : function(props) {
	    var args = {};
	    
	    for (var i = 0, prop; prop = props[i]; i++) {
	        var arr = this[prop];

	        for (var j = 0, obj; obj = arr[j]; j++) {
	            for (var p in obj) {
	                (args[p] || (args[p] = [])).push(obj[p]);
	            }
	        }
	    }
	    
	    for (var a in args) {
	        this[a] = args[a].join(";");
	    }
	},
	

	startup : function(){
		if (this._hasStarted)
			return;

		if (dojo.version.major == 5) {
				this.fixObjProps(['notused']);
		} 

		this._hasStarted = true;
		this.domNode.tabIndex = -1;
		if (typeof(jQuery) == "undefined") {
			dojo.require("calendar.widget.lib.jquery-min");
		}
		dojo.require("calendar.widget.lib.jquery-ui-min");
		if (typeof(jQuery.fullCalendar) == "undefined") {
			dojo.require("calendar.widget.lib.fullcalendar-min");
		}
		if (this.typeAttr != '') {
			this.types = [];
			var keys = this.enumKey.split(';');
			var bgcolors = this.bgColor.split(';');
			var borders = this.border.split(';');
			var textcolors = this.textColor.split(';');
			for (var i = 0; i < keys.length; i++) {
				this.types.push({
					key : keys[i],
					backgroundColor : bgcolors[i],
					borderColor : borders[i],
					textColor : textcolors[i],
					'className' : keys[i]!=''?'calendar_enum_'+keys[i]:'calendar_enum_empty'
				});
			}
		}
		this.actLoaded();
	},
	
	update : function(obj, callback){
		dojo.empty(this.domNode);
		if (obj && obj.getGUID()) {
			this.constraint = this.evtConstraint.replace(/\[\%CurrentObject\%\]/gi, obj.getGUID());
			this.contextGUID = obj.getGUID();
			this.renderCalendar(obj);
		} else if(!obj && this.evtConstraint.indexOf('[%CurrentObject%]') > -1){
			logger.warn('No CurrentObject available. Rendering stopped');
		} else {
			this.constraint = this.evtConstraint;
			this.renderCalendar();
		}
		
		callback && callback();
	},
	
	renderCalendar : function (obj) {
		dojo.empty(this.domNode);
		
		this.domNode.appendChild(mendix.dom.div({ id : this.id+'_calendar' }));
		
		mx.processor.subscribeToClass(this, this.evtEntity);
		
		this.buildviews();
		this.buildCalendar(dojo.hitch(this, this.getObjects));

		if (this.startPos != '' && obj) {
			mx.data.subscribe({
				guid : obj.getGUID(),
				attr : this.startPos,
				callback : dojo.hitch(this, function () {
					jQuery('#'+this.id+'_calendar').fullCalendar('gotoDate', new Date(obj.get(this.startPos)));
				})
			});
			jQuery('#'+this.id+'_calendar').fullCalendar('gotoDate', new Date(obj.get(this.startPos)));
		}
	},
	
	buildviews : function () {
		var views = this.availableViews.split(";");
		var times = this.timeFormatViews.split(";");
		var dates = this.dateFormatViews.split(";");
		var titles = this.titleFormatViews.split(";");
		var labels = this.labelViews.split(";");
		
		this.timeformatObj = {};
		this.timeformatObj[''] = this.timeFormat;
		
		this.titleformatObj = {};
		this.titleformatObj[''] = this.titleFormat;
		
		this.dateformatObj = {};
		this.dateformatObj[''] = this.dateFormat;

		this.labelformatObj = {};
		if (this.todayTranslate != '') {
			this.labelformatObj['today'] = this.todayTranslate;
		}
		//this.labelformatObj[''] = this.dateFormat;
		
		for (var i = 0; views.length > i; i++) {
			if (times[i] != '')
				this.timeformatObj[views[i]] = times[i];
				
			if (titles[i] != '')
				this.titleformatObj[views[i]] = titles[i];
				
			if (dates[i] != '')
				this.dateformatObj[views[i]] = dates[i];
			
			if (labels[i] != '')
				this.labelformatObj[views[i]] = labels[i];
		}
	},
	
	buildCalendar : function (events) {
		var options = {
			editable: !this.readonlyVal,
			height : this.calHeight || 600,
			defaultView : this.defaultView || 'month',
			weekends : this.showWeekends,
			weekNumbers: this.showWeekNumbers,
			weekNumberCalculation: 'iso',
			weekNumberTitle: this.weekNumberTitle,
			timeFormat : this.timeformatObj,
			axisFormat : this.timeFormat,
			titleFormat : this.titleformatObj,
			columnFormat : this.dateformatObj,
			firstDay : this.firstday || 0,
			minTime : this.startTime || 0,
			maxTime : this.endTime || 24,
			buttonText : this.labelformatObj
			/*{
				today : this.todayTranslate || 'today',
				month : this.monthTranslate || 'month',
				week : this.weekTranslate || 'week',
				day : this.dayTranslate || 'day'
			}*/,
			header : {
				left: 'View',
				center : 'title',
				right : 'today '+(this.availableViews != '' ? this.availableViews.replace(/\;/g, ',') : 'month,agendaWeek,agendaDay') +' prev,next'
			},
			dayClick: dojo.hitch(this, function(date, allDay, jsEvent, view) {
				if (this.neweventmf)
					mx.processor.createObject({
						"className"	: this.evtEntity,
						"callback"	: dojo.hitch(this, this.newEvent, date, allDay),
						"context"	: null
					});
			}),
			eventClick: dojo.hitch(this, function(calEvent, jsEvent, view) {
				if (this.listenchannel !== '') {
					dojo.publish(this.getContent() + "/"+this.listenchannel+"/context", [calEvent.obj]);
				}
				this.execclick(calEvent.obj, this.onclickmf);
			}),
			// Documented as viewChange, but is referred to in code as viewDisplay
			viewDisplay: dojo.hitch(this, function( view, element ) {
				if (this.onviewchangemf)
					mx.processor.createObject({
						"className"	: this.evtEntity,
						"callback"	: dojo.hitch(this, this.viewChange, view.start, view.end),
						"context"	: null
					});
			}),
			eventResize : dojo.hitch(this, this.changeEvent),
			eventDrop: dojo.hitch(this, this.changeEvent),
			events: events
		};

		if (this.alldayTranslate !== '') {
			options.allDayText = this.alldayTranslate;
		}
		
		this.setOption(this.monthNamesFormat, 'monthNames', options, 12);
		this.setOption(this.monthShortNamesFormat, 'monthNamesShort', options, 12);
		this.setOption(this.dayNamesFormat, 'dayNames', options, 7);
		this.setOption(this.dayShortNamesFormat, 'dayNamesShort', options, 7);
		
		jQuery('#'+this.id+'_calendar').fullCalendar(options);
	},
	
	setOption : function (attr, type, options, length) {
		if (attr != '') {
			var list = attr.split(",");
			list = dojo.map(list, function (item) {return dojo.trim(item)});
			if (list.length == length)
				options[type] = list;
		}
	},
	
	changeEvent : function (event,dayDelta,minuteDelta,allDay,revertFunc) {
		event.obj.setAttribute(this.startAttr, (+event.start));
		event.obj.setAttribute(this.endAttr, (+event.end));
		event.obj.setAttribute(this.alldayAttr, allDay);
		this.execclick(event.obj, this.onchangemf);
	},
	
	getObjects : function (start, end, callback) {
		if (isNaN(start) || isNaN(end) || typeof start == "Date" || typeof end == "Date") {
			return;
		}
		
		var schema = this.buildSchema();
		
		var xpath = dojo.string.substitute("//${0}${1}[(${2} <= ${3} and ${4} <= ${5}) or (${2} <= ${3} and ${4} >= ${5}) or (${2} >= ${3} and ${4} <= ${5}) or (${2} >= ${3} and ${4} >= ${5})]",
			[this.evtEntity, this.constraint, this.startAttr, (+start), this.endAttr, (+end)]);
		
		mx.processor.get({
			xpath : xpath,
			filter : schema,
			callback : dojo.hitch(this, function (objs) {
				var events = [];
				for (var i = 0; i < objs.length; i++) {
					var obj = objs[i];
					mx.processor.subscribeToGUID(this, obj.getGUID());
					
					var evt = {
						title : this.getTitleAttr(obj),
						start :  new Date(obj.getAttribute(this.startAttr)),
						end :  new Date(obj.getAttribute(this.endAttr)),
						allDay :  this.alldayAttr != '' ? obj.getAttribute(this.alldayAttr) : false,
						url : this.urlAttr != '' ? obj.getAttribute(this.urlAttr) : '',
						obj : obj
					};
					 
					if (this.typeAttr != '') {
						var type = obj.getAttribute(this.typeAttr) || '';
						for (var j = 0; j < this.types.length; j++) {
							if (this.types[j].key == type) {
								dojo.mixin(evt, this.types[j]);
								break;
							}
						}
					}
					
					events.push(evt);
				}
				callback && callback(events);
			}),
			nocache : false
		});
	},

	getTitleAttr : function (obj) {
		var refcheck = this.titleAttr.match("/");
		if (refcheck !== null && refcheck.length > 0) {
			var refattr = this.titleAttr.split("/");
			var child = obj.getChild(refattr[0]);
			if (child.getGUID() <= 0)
				return '';
			else {
				return child.getAttribute(refattr[2]);
			}
		} else {
			return obj.getAttribute(this.titleAttr);
		}
	},

	buildSchema : function () {
		var attrs = [this.titleAttr, this.startAttr, this.endAttr, this.alldayAttr, this.urlAttr, this.typeAttr];
		var schema = {
			attributes 	: [],
			references	: {}
		};
		
		for (var i = attrs.length - 1; i >= 0; i--) {
			var attr = attrs[i];
			if (attr !== '') {
				var refcheck = attr.match("/");
				if (refcheck !== null && refcheck.length > 0) {
					var refattr = attr.split("/");
					var child;
					if (!schema.references[refattr[0]])
						schema.references[refattr[0]] = { attributes : [refattr[2]] };
					else if (dojo.indexOf(schema.references[refattr[0]].attributes, refattr[2]) == -1)
						schema.references[refattr[0]].attributes.push(refattr[2]);
				} else
					schema.attributes.push(attr);
			}
		};

		if (this.customSortAttr != '') {
			schema.sort = [[ this.customSortAttr, this.customSortOrder ]];
		}

		return schema;
	},
	
	newEvent : function (date,allDay,obj) {
		obj.setAttribute(this.startAttr, (+date));
		obj.setAttribute(this.alldayAttr, allDay);
		if (allDay)
			obj.setAttribute(this.endAttr, (+date));
		else
			obj.setAttribute(this.endAttr, (+date)+1000*60*30);
		
		if (this.contextGUID && this.neweventref != '') {
			var ref = this.neweventref.split('/');
			if (obj.hasAttribute(ref[0]))
				obj.setAttribute(ref[0], this.contextGUID);
		}
		
		this.execclick(obj, this.neweventmf, true);
	},
	
	viewChange : function (startdate,enddate,obj) {
		obj.setAttribute(this.startAttr, (+startdate));
		obj.setAttribute(this.endAttr, (+enddate));
		
		this.execclick(obj, this.onviewchangemf, true);
	},
	
	objectUpdateNotification : function (obj, update) {
		jQuery('#'+this.id+'_calendar').fullCalendar('refetchEvents');
	},
	
	execclick : function(mxobj, mf, subscribe) {
		if (subscribe)
			mx.processor.subscribeToGUID(this, mxobj.getGUID());
		
		if (mf != '') {
			var ctxt = this.createContext();
			ctxt.setContext(mxobj.getClass(), mxobj.getGUID());
			mx.xas.action({
				actionname	: mf,
				context		: ctxt,
				callback	: dojo.hitch(this, function() {
					jQuery('#'+this.id+'_calendar').fullCalendar('refetchEvents');
				}),
				error		: function(err) {
					console.error('exec click returned error for obj '+mxobj.getGUID()+' : ',err);
				}
			});	
			mx.ui.destroyContext(ctxt);
		}
	},
	
	uninitialize : function(){
		jQuery('#'+this.id+'_calendar').fullCalendar('destroy');
		this.removeClassSubscriptions();
		this.removeSubscriptions();
	}
};
mendix.widget.declare('calendar.widget.calendar', ___calendarsource);
mendix.widget.declare('calendar.widget.calendar_dv', ___calendarsource);
delete ___calendarsource;