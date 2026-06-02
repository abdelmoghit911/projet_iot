#!/bin/sh
if [ "$SIMULATOR_TYPE" = "gps" ]; then
    exec python gps_simulator.py
elif [ "$SIMULATOR_TYPE" = "can" ]; then
    exec python can_simulator.py
else
    echo "Unknown SIMULATOR_TYPE: $SIMULATOR_TYPE"
    exit 1
fi
