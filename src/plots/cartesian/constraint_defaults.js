/**
* Copyright 2012-2017, Plotly, Inc.
* All rights reserved.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/


'use strict';

var Lib = require('../../lib');
var id2name = require('./axis_ids').id2name;


module.exports = function handleConstraintDefaults(containerIn, containerOut, coerce, counterAxes, layoutOut) {
    var constraintGroups = layoutOut._axisConstraintGroups;

    if(!containerIn.scalewith) return;

    var constraintOpts = getConstraintOpts(constraintGroups, containerOut._id, counterAxes, layoutOut);

    var scalewith = Lib.coerce(containerIn, containerOut, {
        scalewith: {
            valType: 'enumerated',
            values: constraintOpts.linkableAxes
        }
    }, 'scalewith');

    if(scalewith) {
        var scaleratio = coerce('scaleratio');
        // TODO: I suppose I could do attribute.min: Number.MIN_VALUE to avoid zero,
        // but that seems hacky. Better way to say "must be a positive number"?
        // Of course if you use several super-tiny values you could eventually
        // force a product of these to zero and all hell would break loose...
        // Likewise with super-huge values.
        if(!scaleratio) scaleratio = containerOut.scaleratio = 1;

        updateConstraintGroups(constraintGroups, constraintOpts.thisGroup,
            containerOut._id, scalewith, scaleratio);
    }
    else if(counterAxes.indexOf(containerIn.scalewith) !== -1) {
        Lib.warn('ignored ' + containerOut._name + '.scalewith: "' +
            containerIn.scalewith + '" to avoid an infinite loop ' +
            'and possibly inconsistent scaleratios.');
    }
};

function getConstraintOpts(constraintGroups, thisID, counterAxes, layoutOut) {
    // If this axis is already part of a constraint group, we can't
    // scalewith any other axis in that group, or we'd make a loop.
    // Filter counterAxes to enforce this, also matching axis types.

    var thisType = layoutOut[id2name(thisID)].type;

    var i, j, idj;
    for(i = 0; i < constraintGroups.length; i++) {
        if(constraintGroups[i][thisID]) {
            var thisGroup = constraintGroups[i];

            var linkableAxes = [];
            for(j = 0; j < counterAxes.length; j++) {
                idj = counterAxes[j];
                if(!thisGroup[idj] && layoutOut[id2name(idj)].type === thisType) {
                    linkableAxes.push(idj);
                }
            }
            return {linkableAxes: linkableAxes, thisGroup: thisGroup};
        }
    }

    return {linkableAxes: counterAxes, thisGroup: null};
}


/*
 * Add this axis to the axis constraint groups, which is the collection
 * of axes that are all constrained together on scale.
 *
 * constraintGroups: a list of objects. each object is
 * {axis_id: scale_within_group}, where scale_within_group is
 * only important relative to the rest of the group, and defines
 * the relative scales between all axes in the group
 *
 * thisGroup: the group the current axis is already in
 * thisID: the id if the current axis
 * scalewith: the id of the axis to scale it with
 * scaleratio: the ratio of this axis to the scalewith axis
 */
function updateConstraintGroups(constraintGroups, thisGroup, thisID, scalewith, scaleratio) {
    var i, j, groupi, keyj, thisGroupIndex;

    if(thisGroup === null) {
        thisGroup = {};
        thisGroup[thisID] = 1;
        thisGroupIndex = constraintGroups.length;
        constraintGroups.push(thisGroup);
    }
    else {
        thisGroupIndex = constraintGroups.indexOf(thisGroup);
    }

    var thisGroupKeys = Object.keys(thisGroup);

    // we know that this axis isn't in any other groups, but we don't know
    // about the scalewith axis. If it is, we need to merge the groups.
    for(i = 0; i < constraintGroups.length; i++) {
        groupi = constraintGroups[i];
        if(i !== thisGroupIndex && groupi[scalewith]) {
            var baseScale = groupi[scalewith];
            for(j = 0; j < thisGroupKeys.length; j++) {
                keyj = thisGroupKeys[j];
                groupi[keyj] = baseScale * scaleratio * thisGroup[keyj];
            }
            constraintGroups.splice(thisGroupIndex, 1);
            return;
        }
    }

    // otherwise, we insert the new scalewith axis as the base scale (1)
    // in its group, and scale the rest of the group to it
    if(scaleratio !== 1) {
        for(j = 0; j < thisGroupKeys.length; j++) {
            thisGroup[thisGroupKeys[j]] *= scaleratio;
        }
    }
    thisGroup[scalewith] = 1;
}
