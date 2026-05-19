<script setup lang="ts">
import { MachineOutlet, useHsm, useHsmState } from "panom-hsm/vue";

const hsm = useHsm();
const state = useHsmState();

await hsm.start();
</script>

<template>
  <button @click="hsm.transition('app.profile', { params: { username: 'yusuf' } })">
    Open profile
  </button>
  <pre>{{ state.stateId }}</pre>
  <MachineOutlet />
</template>
