$(document).ready(function() {
  /*
   * Globals
   */
  var socket = io.connect();
  socket.reconnect = true;
  var zones;
  /*
   * Respond to socket events
   */
  socket.on('connect', function() {
    $("#server-status")
      .removeClass("btn-danger")
      .addClass("btn-success")
      .addClass("disabled")
      .text("Connected")
      .button("refresh");
  });
  socket.on('emitBrightness', function(data) {
    $("#brightness-slider").slider('value', parseInt(data));
    //$("#brightness-slider").slider('setvalue', parseInt(data));
  });
  socket.on('emitPreset', function(data) {
    $('.btn-preset').removeClass('btn-info').addClass('btn-primary');
    $('#preset-button-' + data).addClass('btn-info').button('refresh');
  });

  /*
   * Upon receipt of an emitPresets event, replace the #list-presets table with
   * an updated version
   */
  socket.on('emitPresets', function(data) {
    /*
     * Build up the table rows first.
     */
    var presetrows = [];
    $.each(data, function(index, preset) {
      /*
       * Update preset buttons on main page
       */
      $('#preset-button-' + index).html(preset['name']);
      presetrows.push($('<tr>')
        .append($('<td>', {style: 'text-align: center'}).text(index + 1))
        .append($('<td>').text(preset['name']))
        .append($('<td>').text(preset['description']))
        .append($('<td>')
          .append($('<button>', {
              'class': 'btn btn-info btn-block open-modal-edit-preset',
              'data-toggle': 'modal',
              'data-target': '#modal-edit-preset',
              'data-id': index,
              'data-name': preset['name'],
              'data-description': preset['description'],
            })
            .text('Edit')
          )
        )
        .append($('<td>')
          .append($('<button>', {
            'class': 'btn btn-danger btn-block open-modal-save-preset',
            'data-toggle': 'modal',
            'data-target': '#modal-save-preset',
            'data-id': index,
            })
            .text('Save')
          )
        )
      )
    });
    /*
     * Now generate the finished table.
     */
    $('#list-presets').empty();
    $('#list-presets')
      .append($('<table>', {"class": "table table-striped table-bordered"})
        .append($('<thead>')
          .append($('<tr>')
            .append($('<th>').text('Preset ID'))
            .append($('<th>').text('Name'))
            .append($('<th>').text('Description'))
            .append($('<th>').attr('colspan', 2).text('Modify'))
          )
        )
        .append($('<tbody>')
          .append(presetrows)
        )
      );
  });

  /*
   * Upon receipt of an emitZones event, replace the #list-zones table with
   * an updated version
   */
  socket.on('emitZones', function(data) {
    zones = data;
    /*
     * Build up the table rows first.
     */
    var zonerows = [];
    $.each(data, function(index, zone) {
      zonerows.push($('<tr>')
        .append($('<td>', {style: "text-align: center"}).text(zone["id"]))
        .append($('<td>').text(zone["name"]))
        .append($('<td>').text(zone["lights"]))
        .append($('<td>').text(zone["description"]))
        .append($('<td>', {style: "background: " + zone["colour"]}))
        .append($('<td>')
          .append($('<button>', {
              'class': 'btn btn-info btn-block open-modal-change-colour',
              'data-toggle': 'modal',
              'data-target': '#modal-change-colour',
              'data-id': index,
            })
            .text('Colour')
          )
        )
        .append($('<td>')
          .append($('<button>', {"class": "btn btn-info btn-block"})
            .text('Details')
          )
        )
        .append($('<td>')
          .append($('<button>', {"class": "btn btn-danger btn-block"})
            .text('Delete')
          )
        )
      )
    });
    /*
     * Now generate the finished table.
     */
    $('#list-zones').empty();
    $('#list-zones')
      .append($('<table>', {"class": "table table-striped table-bordered"})
        .append($('<thead>')
          .append($('<tr>')
            .append($('<th>', {"class": "text-center"}).text('#'))
            .append($('<th>').text('Name'))
            .append($('<th>').text('Lights'))
            .append($('<th>').text('Description'))
            .append($('<th>').text('Colour'))
            .append($('<th>').attr('colspan', 3).text('Modify'))
          )
        )
        .append($('<tbody>')
          .append(zonerows)
        )
      );
  });
  socket.on('emitLights', function(data) {
    var lightToName = {
      "r": "RGB",
      "rf": "RGB+Fade",
      "w": "White"
    }
    var lightrows = [];
    var lightboxes = [];
    $.each(data, function(index, light) {
      var addr = index + 1;
      if (!light || light.type === undefined || !(lightToName[light.type])) {
        return true;
      }
      lightboxes.push($('<input>', {type: "checkbox", name: "lights[]", value: addr}))
      lightboxes.push(' ' + light.description)
      lightboxes.push('<br>')
      if (light.type === "w") {
        var ids = addr;
      } else if (light.type === "r") {
        var ids = addr + ', ' + (addr + 1) + ', ' + (addr + 2);
      } else if (light.type === "rf") {
        var ids = addr + ', ' + (addr + 1) + ', ' + (addr + 2) + ', ' + (addr + 3);
      }
      lightrows.push($('<tr>')
        .append($('<td>', {style: "text-align: center"}).text(ids))
        .append($('<td>').text(lightToName[light.type]))
        .append($('<td>').text(light.description))
        .append($('<td>')
          .append($('<button>', {
              'class': 'btn btn-info btn-block open-modal-edit-light',
              'data-toggle': 'modal',
              'data-target': '#modal-edit-light',
              'data-id': index,
              'data-description': light['description'],
            })
            .text('Edit')
          )
        )
        .append($('<td>')
          .append($('<button>', {
              'class': 'btn btn-danger btn-block open-modal-delete-light',
              'data-toggle': 'modal',
              'data-target': '#modal-delete-light',
              'data-id': index,
            })
            .text('Delete')
          )
        )
      )
    });
    $('#list-lights').empty();
    $('#list-lights')
      .append($('<table>', {"class": "table table-striped table-bordered"})
        .append($('<thead>')
          .append($('<tr>')
            .append($('<th>', {"class": "pagination-centered"}).text('DMX Channels'))
            .append($('<th>').text('Type'))
            .append($('<th>').text('Description'))
            .append($('<th>').attr('colspan', 2).text('Modify'))
          )
        )
        .append($('<tbody>')
          .append(lightrows)
        )
      );
    $('#lightsCheckboxList').empty();
    $('#lightsCheckboxList').append($('<p>').append(lightboxes));
  });
  socket.on('disconnect', function() {
    $("#server-status")
      .removeClass("btn-success")
      .removeClass("disabled")
      .addClass("btn-danger")
      .text("Disconnected!  Click to reconnect.")
      .button("refresh");
  });
  $("#server-status").click(function() {
    socket.socket.reconnect();
  });
  /*
   * Buttons for turning brightness up full or off.
   */
  $("#brightness-on").on('click', function() {
    socket.socket.reconnect();
    socket.emit('setBrightness', 100);
    $('#brightness-slider').slider('value', 100);
  });
  $("#brightness-off").on('click', function() {
    socket.socket.reconnect();
    socket.emit('setBrightness', 0);
    $('#brightness-slider').slider('value', 0);
  });
  /*
   * Set overall brightness via main slider
   */
  $('#brightness-slider').slider({
    orientation: "vertical",
    range: "min",
    min: 0,
    max: 100,
    step: 1,
    value: 60,
    slide: function (ev, ui) {
      socket.socket.reconnect();
      socket.emit('setBrightness', ui.value);
    }
  });
  /*
   * Support draggable
   */
  $('#brightness-slider').draggable();
  $.getJSON('/api/lighting/zones', function(data) {
    var z = [];
    $.each(data, function(index, zone) {
      z.push('<li id="' + index + '">' + zone["name"] + '</li>');
    });
    $('<ul/>', {
      html: z.join('')
    }).html('#zones');
  });

  /* XXX: really?? */
  $('#createNewZone input').keydown(function(e) {
    if (e.keyCode == 13) {
      $('#createNewZone').submit();
    }
  });
  $('#addNewZone').on('shown', function () {
    $('input:text:visible:first', this).focus();
  });
  $('#createNewZone').on('submit', function(event) {
    $.ajax({
      type: "POST",
      url: "/api/lighting/zones",
      data: $(this).serialize(),
      /*
      success:function() {
        $(':input').val('');
      }
      */
    });
    /*
     * Reset form
     */
    $(':input:text').val('');
    $(':input:checkbox').removeAttr('checked');
    event.preventDefault();
    $('#addNewZone').modal('hide');
    return false;
  });
  /*
  $('#createNewLight input').keydown(function(e) {
    if (e.keyCode == 13) {
      $('#createNewLight').submit();
    }
  });
  */
  $('#modal-add-light').on('shown', function () {
    $('input:text:visible:first', this).focus();
  });
  $('#form-add-light').on('submit', function(ev) {
    $.ajax({
      type: "POST",
      url: "/api/lighting/lights",
      data: $(this).serialize(),
      success:function() {
        $(':input').val('');
      }
    });
    ev.preventDefault();
    $('#modal-add-light').modal('hide');
    return false;
  });
  /*
   * Preset edit.  On clicking the 'Edit' button, update the form
   * values based on the data-id of this target.
   */
  $(document).on('click', '.open-modal-edit-preset', function() {
    var presetId = $(this).data('id');
    var presetName = $(this).data('name');
    var presetDescription = $(this).data('description');
    $('#edit-preset-id').val(presetId);
    $('#name').val(presetName);
    $('#description').val(presetDescription);
  });
  $('#form-edit-preset').on('submit', function(event) {
    var formvals = {
      'name': $('#name').val(),
      'description': $('#description').val(),
    };
    $.ajax({
      type: "PUT",
      url: "/api/lighting/preset/" + $('#edit-preset-id').val(),
      data: formvals,
    });
    event.preventDefault();
    $('#modal-edit-preset').modal('hide');
    return false;
  });
  /*$('#modal-edit-preset input').keydown(function(e) {
    if (e.keyCode == 13) {
      $('#form-edit-preset').submit();
    }
  });*/
  /*
   * Colour wheel.
   */
  var wheel;
  $(document).on('click', '.open-modal-change-colour', function() {
    var zoneid = $(this).data('id');
    var pos = $('#colour-wheel').offset();
    var size = $('#colour-wheel').height();
    var startcolour = zones[zoneid].colour;
    $('#modal-change-colour').data('start-colour', startcolour);
    $('#modal-change-colour').data('zone-id', zoneid);
    wheel = Raphael.colorwheel(pos.left, pos.top, 350, startcolour, 'colour-wheel');
    wheel.onchange = function(colour) {
      zones[zoneid].colour = colour
      socket.emit('setZoneColour', {
        'zoneid': zoneid,
        'colour': colour,
      });
    };
    socket.on('emitZones', function(data) {
      $.each(data, function(index, zone) {
        if (index === zoneid) {
          wheel.color(zone.colour);
        }
      });
    });
  });
  $(document).on('click', '#modal-change-colour .revert-colour', function() {
    var revert = {
      'zoneid': $('#modal-change-colour').data('zone-id'),
      'colour': $('#modal-change-colour').data('start-colour'),
    };
    zones[revert.zoneid].colour = revert.colour;
    socket.emit('setZoneColour', revert);
  });
  $(document).on('hide', '#modal-change-colour', function() {
    wheel.remove();
  });
  /*
   * Preset save.  On clicking the 'Save' button, update the form
   * values based on the data-id of this target.
   */
  $(document).on('click', '.open-modal-save-preset', function() {
    var presetId = $(this).data('id');
    $('#save-preset-id').val(presetId);
  });
  $('#form-save-preset').on('submit', function(ev) {
    $.ajax({
      type: "PUT",
      url: "/api/lighting/preset/" + $('#save-preset-id').val(),
      data: {"save": true}
    });
    ev.preventDefault();
    $('#modal-save-preset').modal('hide');
    return false;
  });
  /*
   * Lights modify..
   */
  $(document).on('click', '.open-modal-delete-light', function() {
    $('#delete-light-id').val($(this).data('id'));
  });
  $('#form-delete-light').on('submit', function(ev) {
    $.ajax({
      type: "DELETE",
      url: "/api/lighting/light/" + $('#delete-light-id').val(),
    });
    ev.preventDefault();
    $('#modal-delete-light').modal('hide');
    return false;
  });


  /*
   * Preset button click
   */
  $('.btn-preset').on('click', function(ev) {
    socket.socket.reconnect();
    socket.emit('setPreset', $(this).data('id'));
    /*
     * Reset all buttons then make active primary
     */
    $('.btn-preset').removeClass('btn-info').addClass('btn-primary');
    $(this).addClass('btn-info').button('refresh');
  });
});
